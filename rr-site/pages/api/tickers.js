// pages/api/tickers.js
// Reads your public Google Sheet as CSV and returns JSON.
// Sort: OFFICIAL first, then alphabetical by ticker.

const SHEET_CSV =
  "https://docs.google.com/spreadsheets/d/1XV8KCKkmo_cGUa9Nw2Y6Kdu4bzN6Rn60gKdpCDR32I8/export?format=csv&gid=0";

function csvToRows(csv) {
  return csv
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      line
        // split on commas that aren't inside quotes
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

    // Expect headers like: LONGS | Green L | Red L | PICK TYPE
    const idx = {
      ticker: header.findIndex((h) => /longs/i.test(h)),
      low: header.findIndex((h) => /(green|low)/i.test(h)),
      high: header.findIndex((h) => /(red|high)/i.test(h)),
      pick: header.findIndex((h) => /pick/i.test(h)),
    };

    const items = data
      .map((r) => ({
        ticker: (r[idx.ticker] || "").replace(/[^A-Za-z0-9\.\-]/g, "").toUpperCase(),
        low: Number(r[idx.low]),
        high: Number(r[idx.high]),
        pickType: (r[idx.pick] || "").toUpperCase(), // OFFICIAL / NOT OFFICIAL
      }))
      .filter((x) => x.ticker && isFinite(x.low) && isFinite(x.high));

    items.sort((a, b) => {
      const aOff = a.pickType.includes("OFFICIAL") ? (a.pickType === "OFFICIAL" ? 0 : 1) : 2;
      const bOff = b.pickType.includes("OFFICIAL") ? (b.pickType === "OFFICIAL" ? 0 : 1) : 2;
      if (aOff !== bOff) return aOff - bOff;
      return a.ticker.localeCompare(b.ticker);
    });

    res.status(200).json({ items });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
