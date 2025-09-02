import { useEffect, useMemo, useState } from "react";

// Low = 10, High = 0 (log scale)
function scoreLog10(price, low, high) {
  const p = Math.max(Math.min(price, high), low);
  const s = 10 * (Math.log(high / p) / Math.log(high / low));
  return Math.max(0, Math.min(10, s));
}

function priceFromScore(score, low, high) {
  return high / Math.pow(high / low, score / 10);
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

  // lightbox state
  const [lightboxSrc, setLightboxSrc] = useState("");
  const openLightbox = (chartUrl) => {
    const proxied = `/api/chart?url=${encodeURIComponent(chartUrl)}&t=${Date.now()}`;
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
              idx === i ? { ...row, price: j.price, score: scoreLog10(j.price, row.low, row.high) } : row
            )
          );
        }
      } catch {}
      await new Promise((res) => setTimeout(res, 1500));
    }
    setPriceLoading(false);
  }
  useEffect(() => { loadPrices(); }, [rows.length]);

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
    const currentScore = scoreLog10(price, row.low, row.high);
    // A higher score represents a lower price (10 → 0 scale)
    const upScore = Math.max(currentScore - 3, 0);
    const downScore = Math.min(currentScore + 3, 10);
    setCalcResult({
      up: priceFromScore(upScore, row.low, row.high),
      down: priceFromScore(downScore, row.low, row.high),
    });
  };

  return (
    <div className="container grid">
      <header className="grid">
        <h1>Risk/Reward Tracker</h1>
        <p className="small"> Log score 10→0 with color zones.</p>
        <div className="flex-row">
          <a className="badge" href={process.env.NEXT_PUBLIC_STRIPE_LINK || "#"} target="_blank" rel="noreferrer">
            Subscribe free - Email zone label alerts & future launches
          </a>
          <button className="btn" onClick={loadPrices} disabled={priceLoading}>
            {priceLoading ? "Refreshing…" : "Refresh current prices"}
          </button>
        </div>
      </header>

      {error && <div className="card" style={{ borderColor: "#a13232" }}>Error: {error}</div>}
      {loading && !rows.length && <div className="card">Loading tickers…</div>}

      {!!rows.length && (
        <section className="card">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => requestSort("ticker")}>Ticker</th>
                <th className="sortable" onClick={() => requestSort("pickType")}>Pick</th>
                <th className="sortable" onClick={() => requestSort("low")}>Low</th>
                <th className="sortable" onClick={() => requestSort("high")}>High</th>
                <th className="sortable" onClick={() => requestSort("gain")}>Potential % Gain</th>
                <th className="sortable" onClick={() => requestSort("price")}>Current Price</th>
                <th className="sortable" onClick={() => requestSort("score")}>R/R Level</th>
                <th>Chart</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const thumb = r.chartUrl
                  ? `/api/chart?url=${encodeURIComponent(r.chartUrl)}&t=${Date.now()}`
                  : "";
                return (
                  <tr key={r.ticker}>
                    <td>{r.ticker}</td>
                    <td className="small">{r.pickType}</td>
                    <td>${r.low.toFixed(2)}</td>
                    <td>${r.high.toFixed(2)}</td>
                    <td>
                      {r.price != null
                        ? `${(((r.high - r.price) / r.price) * 100).toFixed(2)}%`
                        : <span className="small">-</span>}
                    </td>
                    <td>{r.price != null ? `$${Number(r.price).toFixed(2)}` : <span className="small">loading…</span>}</td>
                    <td>{r.score != null ? r.score.toFixed(2) : "-"}</td>
                    <td>
                      {thumb ? (
                        <button className="thumbbtn" onClick={() => openLightbox(r.chartUrl)} aria-label={`Open ${r.ticker} chart`}>
                          <img src={thumb} alt={`${r.ticker} chart`} className="thumb" loading="lazy" />
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
            <img src={lightboxSrc} alt="Chart" className="lightbox-img" />
          </div>
        </div>
      )}
    </div>
  );
}
