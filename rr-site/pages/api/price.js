// pages/api/price.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    const symbol =
      String(req.query.symbol || req.query.ticker || "").toUpperCase();
    if (!symbol) return res.status(400).json({ error: "symbol required" });

    // 1) Try KV snapshot first (populated by /api/cron/check-crossings)
    const stateKey = `alert:${symbol}`;
    const snap = await kv.get(stateKey);
    if (snap?.lastClose && snap?.lastDate) {
      // backward-compatible: still return { price }, but include extras too
      return res.status(200).json({
        price: snap.lastClose,
        date: snap.lastDate,
        source: "kv",
        ticker: symbol,
      });
    }

    // 2) Fallback to Alpha Vantage GLOBAL_QUOTE only if needed
    const key = process.env.ALPHA_VANTAGE_KEY;
    if (!key) {
      // No KV and no Alpha key → just return null price gracefully
      return res.status(200).json({ price: null, source: "none", ticker: symbol });
    }

    const r = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
        symbol
      )}&apikey=${key}`,
      { cache: "no-store" }
    );

    const data = await r.json();
    const price = Number(data?.["Global Quote"]?.["05. price"]);
    if (!Number.isFinite(price)) {
      return res.status(404).json({ error: "no price" });
    }

    // Cache it back into KV so future reads are instant
    const today = new Date().toISOString().slice(0, 10);
    await kv.set(stateKey, {
      ...(snap || {}),
      lastClose: price,
      lastDate: today,
    });

    return res.status(200).json({ price, date: today, source: "alpha", ticker: symbol });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
