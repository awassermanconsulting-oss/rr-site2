import { useEffect, useMemo, useState } from "react";

// Zone labels
const ZONE_LABEL = (score) => {
  if (score >= 7) return { name: "Buy Zone", className: "badge badge-green" };
  if (score >= 5) return { name: "Below Halfway Point", className: "badge badge-yellow" };
  if (score >= 2) return { name: "Above Halfway Point", className: "badge badge-orange" };
  return { name: "Sell Zone", className: "badge badge-red" };
};

// Low = 10, High = 0 (log scale)
function scoreLog10(price, low, high) {
  const p = Math.max(Math.min(price, high), low);
  const s = 10 * (Math.log(high / p) / Math.log(high / low));
  return Math.max(0, Math.min(10, s));
}

export default function Home() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [priceLoading, setPriceLoading] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="container grid">
      <header className="grid">
        <h1>Risk/Reward Tracker</h1>
        <p className="small">Auto-pulls Mark’s tickers from the shared sheet. Log score 10→0 with color zones.</p>
        <div className="flex-row">
          <a className="badge" href={process.env.NEXT_PUBLIC_STRIPE_LINK || "#"} target="_blank" rel="noreferrer">
            Subscribe – $1/month
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
                <th>Ticker</th>
                <th>Pick</th>
                <th>Low</th>
                <th>High</th>
                <th>Current Price</th>
                <th>Current R/R Zone</th>
                <th>Zone Label</th>
                <th>Chart</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const zone = r.score != null ? ZONE_LABEL(r.score) : null;
                const thumb = r.chartUrl
                  ? `/api/chart?url=${encodeURIComponent(r.chartUrl)}&t=${Date.now()}`
                  : "";
                return (
                  <tr key={r.ticker}>
                    <td>{r.ticker}</td>
                    <td className="small">{r.pickType}</td>
                    <td>${r.low.toFixed(2)}</td>
                    <td>${r.high.toFixed(2)}</td>
                    <td>{r.price != null ? `$${Number(r.price).toFixed(2)}` : <span className="small">loading…</span>}</td>
                    <td>{r.score != null ? r.score.toFixed(2) : "-"}</td>
                    <td>{zone ? <span className={zone.className}>{zone.name}</span> : "-"}</td>
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

      <section className="card small" style={{ lineHeight: 1.4 }}>
        <strong>Disclaimer:</strong> The “Low” and “High” lines reflect values as of the original
        publishing date and may change over time. Current prices are fetched from third-party
        sources and may be delayed. Nothing here is investment advice or a recommendation, and
        this site is not affiliated with or acting on behalf of Mark. For personal entertainment only.
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
