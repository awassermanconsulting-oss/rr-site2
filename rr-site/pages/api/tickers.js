const SHEET_CSV =
  "https://docs.google.com/spreadsheets/d/1XV8KCKkmo_cGUa9Nw2Y6Kdu4bzN6Rn60gKdpCDR32I8/export?format=csv&gid=0";

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
      chart: header.findIndex((h) => /chart/i.test(h)), // optional
    };

    const items = data
      .map((r) => ({
        ticker: (r[idx.ticker] || "").replace(/[^A-Za-z0-9.\-]/g, "").toUpperCase(),
        low: Number(r[idx.low]),
        high: Number(r[idx.high]),
        pickType: (r[idx.pick] || "").toUpperCase(),
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

    res.status(200).json({ items });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
