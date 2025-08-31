import { useEffect, useMemo, useState } from "react";

const badgeFor = (score) => {
  if (score >= 7) return { label: "Green", className: "badge badge-green" };
  if (score >= 5) return { label: "Yellow", className: "badge badge-yellow" };
  if (score >= 2) return { label: "Orange", className: "badge badge-orange" };
  return { label: "Red", className: "badge badge-red" };
};

// Low = 10, High = 0 (log scale)
function scoreLog10(price, low, high) {
  // keep in bounds
  const p = Math.max(Math.min(price, high), low);
  const s = 10 * (Math.log(high / p) / Math.log(high / low));
  return Math.max(0, Math.min(10, s));
}

export default function Home() {
  const [rows, setRows] = useState([]); // {ticker, low, high, pickType, price, score}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // fetch sheet tickers
  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  // fetch prices with pacing to respect Alpha Vantage free limits (~5/min)
  useEffect(() => {
    let cancel = false;
    (async () => {
      for (let i = 0; i < rows.length; i++) {
        if (cancel) break;
        const t = rows[i].ticker.replace(".TO", ".TRT"); // example mapping if needed
        try {
          const r = await fetch(`/api/price?symbol=${encodeURIComponent(t)}`);
          const { price } = await r.json();
          if (price) {
            setRows((prev) =>
              prev.map((row, idx) =>
                idx === i
                  ? { ...row, price, score: scoreLog10(price, row.low, row.high) }
                  : row
              )
            );
          }
        } catch (e) {}
        // wait ~15s between calls to be gentle on free API
        await new Promise((res) => setTimeout(res, 1500));
      }
    })();
    return () => {
      cancel = true;
    };
  }, [rows.length]);

  const hasPrices = useMemo(() => rows.some((r) => r.price != null), [rows]);

  return (
    <div className="container grid">
      <header className="grid">
        <h1>Risk/Reward Tracker</h1>
        <p className="small">Auto-pulls Mark’s tickers from the shared sheet. Colors reflect 10→0 log score.</p>
        <div>
          <a
            className="badge"
            href={process.env.NEXT_PUBLIC_STRIPE_LINK || "#"}
            target="_blank"
            rel="noreferrer"
          >
            Subscribe – $1/month
          </a>
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
                <th>Price</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const badge = r.score != null ? badgeFor(r.score) : null;
                return (
                  <tr key={r.ticker}>
                    <td>{r.ticker}</td>
                    <td className="small">{r.pickType}</td>
                    <td>${r.low.toFixed(2)}</td>
                    <td>${r.high.toFixed(2)}</td>
                    <td>{r.price != null ? `$${Number(r.price).toFixed(2)}` : <span className="small">loading…</span>}</td>
                    <td>{r.score != null ? r.score.toFixed(2) : "-"}</td>
                    <td>{badge ? <span className={badge.className}>{badge.label}</span> : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!hasPrices && (
            <div className="small" style={{ marginTop: 8 }}>
              Prices load gradually to respect free data limits.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
