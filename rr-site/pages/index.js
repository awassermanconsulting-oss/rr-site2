import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

// Generic log scale where "top" is the score assigned to the high price
function scoreLog10(price, low, high, top = 0) {
  const p = Math.max(Math.min(price, high), low);
  const ratio = Math.log(high / p) / Math.log(high / low);
  const s = top + (10 - top) * ratio;
  return Math.max(top, Math.min(10, s));
}

function priceFromScore(score, low, high, top = 0) {
  const ratio = (score - top) / (10 - top);
  return high / Math.pow(high / low, ratio);
}

export default function Home() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [priceLoading, setPriceLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [calcTicker, setCalcTicker] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [calcResult, setCalcResult] = useState(null);
  const [topScore, setTopScore] = useState(0);

  // lightbox state
  const [lightboxSrc, setLightboxSrc] = useState("");
  const openLightbox = (chartUrl) => {
    const proxied = `/api/chart?url=${encodeURIComponent(chartUrl)}`;
    setLightboxSrc(proxied);
    document.body.style.overflow = "hidden"; // prevent background scroll
  };
  const closeLightbox = () => {
    setLightboxSrc("");
    document.body.style.overflow = "";
  };
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeLightbox();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // load tickers from your Google Sheet
  async function loadTickers() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/tickers");
      const { items, error } = await r.json();
      if (error) throw new Error(error);
      setRows(items.map((x) => ({ ...x, price: null, score: null })));
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadTickers(); }, []);

  // fetch prices (paced for free API limits)
  async function loadPrices() {
    if (!rows.length) return;
    setPriceLoading(true);
    for (let i = 0; i < rows.length; i++) {
      const t = rows[i].ticker;
      try {
        const r = await fetch(`/api/price?symbol=${encodeURIComponent(t)}`);
        const j = await r.json();
        if (j && typeof j.price === "number") {
          setRows((prev) =>
            prev.map((row, idx) =>
              idx === i
                ? { ...row, price: j.price, score: scoreLog10(j.price, row.low, row.high, topScore) }
                : row
            )
          );
        }
      } catch {}
      await new Promise((res) => setTimeout(res, 1500));
    }
    setPriceLoading(false);
  }
  useEffect(() => { loadPrices(); }, [rows.length]);

  useEffect(() => {
    setRows((prev) =>
      prev.map((r) =>
        r.price != null ? { ...r, score: scoreLog10(r.price, r.low, r.high, topScore) } : r
      )
    );
    setCalcResult(null);
  }, [topScore]);

  const hasPrices = useMemo(() => rows.some((r) => r.price != null), [rows]);
  const sortedRows = useMemo(() => {
    const sortable = [...rows];
    const { key, direction } = sortConfig;
    if (!key) return sortable;
    return sortable.sort((a, b) => {
      const getVal = (row) => {
        switch (key) {
          case "ticker":
            return row.ticker;
          case "pickType":
            return row.pickType;
          case "low":
            return row.low;
          case "high":
            return row.high;
          case "price":
            return row.price;
          case "score":
            return row.score;
          case "gain":
            return row.price != null ? ((row.high - row.price) / row.price) * 100 : null;
          default:
            return null;
        }
      };
      const valA = getVal(a);
      const valB = getVal(b);
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === "string") {
        return direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return direction === "asc" ? valA - valB : valB - valA;
    });
  }, [rows, sortConfig]);

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const handleCalc = () => {
    const row = rows.find((r) => r.ticker === calcTicker);
    const price = parseFloat(buyPrice);
    if (!row || isNaN(price)) {
      setCalcResult(null);
      return;
    }
    const currentScore = scoreLog10(price, row.low, row.high, topScore);
    // A higher score represents a lower price (10 → topScore scale)
    const upScore = Math.max(currentScore - 3, topScore);
    const downScore = Math.min(currentScore + 3, 10);
    setCalcResult({
      up: priceFromScore(upScore, row.low, row.high, topScore),
      down: priceFromScore(downScore, row.low, row.high, topScore),
    });
  };

  return (
    <div className="container grid">
      <header className="grid">
        <h1>Risk/Reward Tracker</h1>
        <p className="small"> Log score 10→{topScore} with color zones.</p>
        <div className="flex-row">
          <button className="btn" onClick={loadPrices} disabled={priceLoading}>
            {priceLoading ? "Refreshing…" : "Refresh current prices"}
          </button>
        </div>
      </header>

      {error && <div className="card" style={{ borderColor: "#a13232" }}>Error: {error}</div>}
      {loading && !rows.length && <div className="card">Loading tickers…</div>}

      {!!rows.length && (
        <section className="card">
          <div style={{ marginBottom: 8 }}>
            <label>
              Interval:
              <select value={topScore} onChange={(e) => setTopScore(Number(e.target.value))}>
                <option value={0}>[10,0]</option>
                <option value={1}>[10,1]</option>
              </select>
            </label>
          </div>
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => requestSort("ticker")}>Ticker</th>
                <th className="sortable" onClick={() => requestSort("pickType")}>Pick</th>
                <th className="sortable" onClick={() => requestSort("low")}>Low</th>
                <th className="sortable" onClick={() => requestSort("high")}>High</th>
                <th className="sortable" onClick={() => requestSort("price")}>Current Price</th>
                <th className="sortable" onClick={() => requestSort("gain")}>Potential % Gain</th>
                <th className="sortable" onClick={() => requestSort("score")}>R/R Level</th>
                <th>Chart</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const thumb = r.chartUrl
                  ? `/api/chart?url=${encodeURIComponent(r.chartUrl)}`
                  : "";
                return (
                  <tr key={r.ticker}>
                    <td>{r.ticker}</td>
                    <td className="small">{r.pickType}</td>
                    <td>${r.low.toFixed(2)}</td>
                    <td>${r.high.toFixed(2)}</td>
                    <td>{r.price != null ? `$${Number(r.price).toFixed(2)}` : <span className="small">loading…</span>}</td>
                    <td>
                      {r.price != null
                        ? `${(((r.high - r.price) / r.price) * 100).toFixed(2)}%`
                        : <span className="small">-</span>}
                    </td>
                    <td>{r.score != null ? r.score.toFixed(2) : "-"}</td>
                    <td>
                      {thumb ? (
                        <button className="thumbbtn" onClick={() => openLightbox(r.chartUrl)} aria-label={`Open ${r.ticker} chart`}>
                          <Image
                            src={thumb}
                            alt={`${r.ticker} chart`}
                            className="thumb"
                            width={180}
                            height={100}
                            loading="lazy"
                          />
                        </button>
                      ) : (
                        <span className="small">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!hasPrices && <div className="small" style={{ marginTop: 8 }}>Prices load gradually to respect free data limits.</div>}
        </section>
      )}

      {!!rows.length && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>R/R Move Calculator</h2>
          <div>
            <label>
              Stock:
              <select value={calcTicker} onChange={(e) => setCalcTicker(e.target.value)}>
                <option value="">Select a stock</option>
                {rows.map((r) => (
                  <option key={r.ticker} value={r.ticker}>
                    {r.ticker}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label>
              Buy price:
              <input
                type="number"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
              />
            </label>
          </div>
          <button className="btn" onClick={handleCalc} style={{ marginTop: 8 }}>
            Calculate
          </button>
          {calcResult && (
            <div style={{ marginTop: 8 }}>
              <div>3-point move up: ${calcResult.up.toFixed(2)}</div>
              <div>3-point move down: ${calcResult.down.toFixed(2)}</div>
            </div>
          )}
        </section>
      )}

      <section className="card small" style={{ lineHeight: 1.4, marginTop: 16 }}>
        <strong>Formulas:</strong>
        <pre className="math">{`[10,0] (topScore = 0): score = 10 × log(high / price) / log(high / low)
[10,1] (topScore = 1): score = 1 + 9 × log(high / price) / log(high / low)

3pt up   = price × (high / low)^(3 / (10 - topScore))
3pt down = price ÷ (high / low)^(3 / (10 - topScore))`}</pre>
      </section>

      <section className="card small" style={{ lineHeight: 1.4 }}>
        <strong>Disclaimer:</strong> The “Low” and “High” lines reflect values as of the original
        publishing date and may change over time. Current prices are fetched from third-party
        sources and may be delayed. Nothing here is investment advice or a recommendation, and
        this site is not affiliated with or acting on behalf of Mark. For personal entertainment only. 
        All numbers are completely fictional. Any resemblence to actual numbers is coincidence & not guaranteed. 
    
      </section>

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="lightbox" onClick={closeLightbox}>
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox} aria-label="Close">×</button>
            <Image
              src={lightboxSrc}
              alt="Chart"
              className="lightbox-img"
              width={1200}
              height={800}
            />
          </div>
        </div>
      )}
    </div>
  );
}
