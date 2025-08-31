// Per-ticker zone-change alerts with a 7-day cooldown (at most 1 email per ticker per week).
// Uses Vercel KV to remember last zone + last email time.

import { kv } from "@vercel/kv";
import { Resend } from "resend";
import { listSubscribers } from "../../../lib/subscribers";

// Given low/high and a score S in [0..10], return the price at that score line.
// s = 10 * log(high/p) / log(high/low)  =>  p = high / (high/low)^(s/10)
function priceAtScore(low, high, s) {
  const ratio = high / low;
  const p = high / Math.pow(ratio, s / 10);
  return p;
}

// PRICE direction (not zone-index direction)
function priceDirection(fromZone, toZone) {
  if (toZone < fromZone) return "UP";
  if (toZone > fromZone) return "DOWN";
  return "FLAT";
}

// If zone changed, what boundary did we cross (7,5,2)?
function crossedBoundary(fromZone, toZone) {
  if (fromZone === toZone) return null;
  const step = toZone > fromZone ? 1 : -1;
  const edgeIndex = (toZone > fromZone ? toZone : fromZone) - (step > 0 ? 0 : 1);
  const zoneEdgeToScore = { 3: 7, 2: 5, 1: 2 };
  return zoneEdgeToScore[edgeIndex] ?? null;
}

function zoneName(idx) {
  return ["Sell Zone", "Above Halfway Point", "Below Halfway Point", "Buy Zone"][idx];
}

// ---- scoring / zones (same as UI) ----
function scoreLog(price, low, high) {
  const p = Math.max(Math.min(price, high), low);
  const s = 10 * (Math.log(high / p) / Math.log(high / low));
  return Math.max(0, Math.min(10, s));
}
function zoneIndex(s) {
  if (s >= 7) return 3;      // 10–7
  if (s >= 5) return 2;      // 7–5
  if (s >= 2) return 1;      // 5–2
  return 0;                  // 2–0
}

// ---- config ----
const ALPHA = process.env.ALPHA_VANTAGE_KEY;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PER_RUN = 100; // big enough to cover all tickers in one daily run
const resend = new Resend(process.env.RESEND_API_KEY);

async function getDailyClose(symbol) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(
    symbol
  )}&apikey=${ALPHA}&outputsize=compact`;
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  const series = j["Time Series (Daily)"];
  if (!series) return null;
  const [date, row] = Object.entries(series)[0];
  return { date, close: Number(row["4. close"]) };
}

async function maybeEmail({ ticker, fromZone, toZone, price, date, low, high }) {
  const stateKey = `alert:${ticker}`;
  const last = (await kv.get(stateKey)) || { lastZone: null, lastEmailAt: 0 };
  const now = Date.now();
  const onCooldown = now - (last.lastEmailAt || 0) < COOLDOWN_MS;

  let newState = { lastZone: toZone, lastEmailAt: last.lastEmailAt };
  let sent = false;

  if (!onCooldown && process.env.RESEND_API_KEY && process.env.ALERT_FROM) {
    const recipients = await listSubscribers();
    if (!recipients.length) {
      console.log("[email] no active subscribers; skipping send");
    } else {
      const direction = priceDirection(fromZone, toZone); // "UP" | "DOWN"
      const boundary = crossedBoundary(fromZone, toZone); // 7 | 5 | 2 | null
      const boundaryPrice = boundary ? priceAtScore(low, high, boundary) : null;

      const fromLabel = zoneName(fromZone);
      const toLabel   = zoneName(toZone);

      const subject = `R/R alert: ${ticker} moved ${direction} in price into ${toLabel}`;
      const html = `
        <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
          <h2 style="margin:0 0 8px 0">${ticker} moved ${direction} in price</h2>
          <p style="margin:0 0 6px 0"><strong>From:</strong> ${fromLabel}</p>
          <p style="margin:0 0 6px 0"><strong>To:</strong> ${toLabel}</p>
          ${
            boundary && boundaryPrice
              ? `<p style="margin:0 0 6px 0"><strong>Crossed:</strong> ${boundary}-line near ~$${boundaryPrice.toFixed(2)}</p>`
              : ""
          }
          <p style="margin:0 0 6px 0"><strong>Latest close:</strong> $${price.toFixed(2)} <span style="color:#666">(as of ${date})</span></p>
          <hr style="border:none;border-top:1px solid #ddd;margin:12px 0" />
          <p style="font-size:12px;color:#666;margin:0">Max one alert per ticker per 7 days. Not investment advice.</p>
        </div>`;

      try {
        console.log(`[email] ${ticker}: sending to ${recipients.length} subscriber(s)`);
        await resend.emails.send({
          from: process.env.ALERT_FROM,
          to: recipients, // array of subscriber emails from KV
          subject,
          html,
        });
        newState.lastEmailAt = now;
        sent = true;
        console.log(`[email] ${ticker}: sent`);
      } catch (e) {
        console.log(`[email] ${ticker}: FAILED -> ${e?.message || e}`);
        // keep lastEmailAt unchanged so we can retry later
      }
    }
  } else {
    if (onCooldown) console.log(`[cooldown] ${ticker}: within 7 days, no email`);
  }

  await kv.set(stateKey, newState);
  return sent;
}

export default async function handler(req, res) {
  try {
    if (!ALPHA) return res.status(500).json({ error: "Missing ALPHA_VANTAGE_KEY" });
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN)
      return res.status(500).json({ error: "Vercel KV env vars missing" });

    const origin = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
    const listResp = await fetch(`${origin}/api/tickers`, { cache: "no-store" });
    const { items = [] } = await listResp.json();
    if (!items.length) return res.status(200).json({ processed: 0, sent: 0 });

    const total = items.length;
    const start = (await kv.get("alert:cursor")) || 0;
    const slice = items.slice(start, Math.min(start + PER_RUN, total));
    const nextCursor = (start + PER_RUN) % total;

    console.log(`[cron] processing ${slice.length}/${total} (cursor ${start} → ${nextCursor})`);

    let sent = 0;
    for (const it of slice) {
      const { ticker, low, high } = it;
      console.log(`[check] ${ticker}: low=${low}, high=${high}`);
      const latest = await getDailyClose(ticker);
      if (!latest || !Number.isFinite(latest.close)) {
        console.log(`[check] ${ticker}: no daily close available`);
        continue;
      }

      const s = scoreLog(latest.close, low, high);
      const z = zoneIndex(s);
      console.log(`[score] ${ticker}: close=$${latest.close.toFixed(2)} score=${s.toFixed(2)} zone=${zoneName(z)}`);

      const stateKey = `alert:${ticker}`;
      const prev = (await kv.get(stateKey)) || { lastZone: z, lastEmailAt: 0 };

      if (prev.lastZone !== z) {
        console.log(`[cross] ${ticker}: ${zoneName(prev.lastZone)} → ${zoneName(z)}`);
        const didSend = await maybeEmail({
          ticker,
          fromZone: prev.lastZone,
          toZone: z,
          price: latest.close,
          date: latest.date,
          low,
          high,
        });
        sent += didSend ? 1 : 0;
      } else {
        await kv.set(stateKey, prev);
        console.log(`[steady] ${ticker}: still ${zoneName(z)}`);
      }
    }

    await kv.set("alert:cursor", nextCursor);
    console.log(`[cron] done: emails sent=${sent}`);
    return res.status(200).json({ processed: slice.length, total, sent, nextCursor });
  } catch (e) {
    console.log(`[error] ${e?.message || e}`);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
