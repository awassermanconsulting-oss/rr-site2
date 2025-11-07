const SHEET_CSV =
  "https://docs.google.com/spreadsheets/d/1XV8KCKkmo_cGUa9Nw2Y6Kdu4bzN6Rn60gKdpCDR32I8/export?format=csv&gid=0";

let cache = { items: null, expiry: 0 };

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
    const bypassCache =
      "refresh" in req.query || "nocache" in req.query || req.query.cache === "false";
    const filterTicker =
      typeof req.query.ticker === "string"
        ? req.query.ticker.trim().toUpperCase()
        : typeof req.query.symbol === "string"
        ? req.query.symbol.trim().toUpperCase()
        : "";

    const applyFilter = (items) =>
      filterTicker
        ? items.filter((item) => item.ticker.toUpperCase() === filterTicker)
        : items;

    if (!bypassCache && cache.items && Date.now() < cache.expiry) {
      res.setHeader("Cache-Control", "public, s-maxage=300");
      return res.status(200).json({ items: applyFilter(cache.items), cached: true });
    }

    const r = await fetch(SHEET_CSV, { cache: "no-store" });
    if (!r.ok) throw new Error("sheet fetch failed");
    const text = await r.text();
    const rows = csvToRows(text);
    const [header, ...data] = rows;

    const idx = {
      ticker: header.findIndex((h) => /longs?/i.test(h)),
      low: header.findIndex((h) => /(green|low)/i.test(h)),
      high: header.findIndex((h) => /(red|high)/i.test(h)),
      pick: header.findIndex((h) => /pick/i.test(h)),
      price: header.findIndex((h) => /(price|close|last)/i.test(h)),
      chart: header.findIndex((h) => /chart/i.test(h)), // optional
    };

    const items = data
      .map((r) => ({
        ticker: (r[idx.ticker] || "").replace(/[^A-Za-z0-9.\-]/g, "").toUpperCase(),
        low: Number(r[idx.low]),
        high: Number(r[idx.high]),
        pickType: (r[idx.pick] || "").toUpperCase(),
        price: idx.price >= 0 ? Number(r[idx.price]) : null,
        chartUrl: idx.chart >= 0 ? (r[idx.chart] || "").trim() : "",
      }))
      .filter((x) => x.ticker && isFinite(x.low) && isFinite(x.high));

    items.sort((a, b) => {
      const rank = (p) => (p === "OFFICIAL" ? 0 : p.includes("OFFICIAL") ? 1 : 2);
      const aOff = rank(a.pickType);
      const bOff = rank(b.pickType);
      if (aOff !== bOff) return aOff - bOff;
      return a.ticker.localeCompare(b.ticker);
    });

    cache = { items, expiry: Date.now() + 300000 };
    if (bypassCache) {
      res.setHeader("Cache-Control", "no-store");
    } else {
      res.setHeader("Cache-Control", "public, s-maxage=300");
    }
    res.status(200).json({ items: applyFilter(items), cached: !bypassCache });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
