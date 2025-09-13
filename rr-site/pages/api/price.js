// pages/api/price.js
import { kv } from "@vercel/kv";

const SHEET_CSV =
  "https://docs.google.com/spreadsheets/d/1XV8KCKkmo_cGUa9Nw2Y6Kdu4bzN6Rn60gKdpCDR32I8/export?format=csv&gid=0";

const cache = new Map();

function csvToRows(csv) {
  return csv
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      line
        .match(/("(?:[^"]|"")*"|[^,]+)/g)
        .map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"').trim())
    );
}

export default async function handler(req, res) {
  try {
    const symbol =
      String(req.query.symbol || req.query.ticker || "").toUpperCase();
    if (!symbol) return res.status(400).json({ error: "symbol required" });

    const cached = cache.get(symbol);
    if (cached && cached.expiry > Date.now()) {
      res.setHeader("Cache-Control", "public, s-maxage=300");
      return res.status(200).json(cached.data);
    }

    // 1) Try KV snapshot first (populated by /api/cron/check-crossings)
    const stateKey = `alert:${symbol}`;
    const snap = await kv.get(stateKey);
    if (snap?.lastClose && snap?.lastDate) {
      // backward-compatible: still return { price }, but include extras too
      const result = {
        price: snap.lastClose,
        date: snap.lastDate,
        source: "kv",
        ticker: symbol,
      };
      cache.set(symbol, { data: result, expiry: Date.now() + 300000 });
      res.setHeader("Cache-Control", "public, s-maxage=300");
      return res.status(200).json(result);
    }

    // 2) Fallback to Google Sheet if KV miss
    const r = await fetch(SHEET_CSV, { cache: "no-store" });
    if (!r.ok) {
      res.setHeader("Cache-Control", "public, s-maxage=300");
      return res.status(200).json({ price: null, source: "none", ticker: symbol });
    }

    const text = await r.text();
    const rows = csvToRows(text);
    const [header, ...data] = rows;
    const idx = {
      ticker: header.findIndex((h) => /longs?/i.test(h)),
      price: header.findIndex((h) => /(price|close|last)/i.test(h)),
    };
    const row = data.find(
      (r) =>
        (r[idx.ticker] || "")
          .replace(/[^A-Za-z0-9.\-]/g, "")
          .toUpperCase() === symbol
    );
    const price = row ? Number(row[idx.price]) : NaN;
    if (!Number.isFinite(price)) {
      res.setHeader("Cache-Control", "public, s-maxage=300");
      return res.status(404).json({ error: "no price" });
    }

    const today = new Date().toISOString().slice(0, 10);
    await kv.set(stateKey, {
      ...(snap || {}),
      lastClose: price,
      lastDate: today,
    });

    const result = { price, date: today, source: "sheet", ticker: symbol };
    cache.set(symbol, { data: result, expiry: Date.now() + 300000 });
    res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
