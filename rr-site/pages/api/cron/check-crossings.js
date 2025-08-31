// Per-ticker zone-change alerts with a 7-day cooldown (at most 1 email per ticker per week).
// Uses Vercel KV to remember last zone + last email time.

import { kv } from "@vercel/kv";
import { Resend } from "resend";

// Score thresholds that define the zone edges
const BOUNDARIES = [7, 5, 2]; // (between 10–7, 7–5, 5–2, 2–0)

// Given low/high and a score S in [0..10], return the price at that score line.
function priceAtScore(low, high, s) {
  const ratio = high / low;
  const p = high / Math.pow(ratio, s / 10);
  return p;
}

function directionWord(fromZone, toZone) {
  // Higher zone index => price went DOWN (toward Buy Zone).
  if (toZone > fromZone) return "down";
  if (toZone < fromZone) return "up";
  return "flat";
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
const PER_RUN = 100; // process a few tickers per run to respect Alpha free limits
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

  if (!onCooldown && process.env.RESEND_API_KEY && process.env.ALERT_FROM && process.env.ALERT_TO) {
    const direction = directionWord(fromZone, toZone);
    const boundary = crossedBoundary(fromZone, toZone);
    const boundaryPrice = boundary ? priceAtScore(low, high, boundary) : null;

    const subject = `R/R alert: ${ticker} moved ${direction} into ${zoneName(toZone)}`;
    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
        <h2>${ticker} crossed into ${zoneName(toZone)}</h2>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Move:</strong> ${zoneName(fromZone)} → ${zoneName(toZone)} (${direction})</p>
        <p><strong>Latest close:</strong> $${price.toFixed(2)}</p>
        ${
          boundary && boundaryPrice
            ? `<p><strong>Crossed:</strong> ${boundary} line at ~$${boundaryPrice.toFixed(2)}</p>`
            : ""
        }
        <hr />
        <p style="font-size:12px;color:#666">Max one alert per ticker per 7 days. Not investment advice.</p>
      </div>`;

    try {
      await resend.emails.send({
        from: process.env.ALERT_FROM,
        to: process.env.ALERT_TO, // later: subscriber emails
        subject,
        html,
      });
      newState.lastEmailAt = now;
      sent = true;
    } catch (_) {
      // if email fails, keep lastEmailAt unchanged so we can retry on next run
    }
  }

  await kv.set(stateKey, newState);
  return sent;
}

export default async function handler(req, res) {
  try {
    if (!ALPHA) return res.status(500).json({ error: "Missing ALPHA_VANTAGE_KEY" });
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN)
      return res.status(500).json({ error: "Vercel KV env vars missing" });

    // get sheet data
    const origin = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
    const listResp = await fetch(`${origin}/api/tickers`, { cache: "no-store" });
    const { items = [] } = await listResp.json();
    if (!items.length) return res.status(200).json({ processed: 0, sent: 0 });

    // cursor so we only hit a few symbols per run
    const total = items.length;
    const start = (await kv.get("alert:cursor")) || 0;
    const slice = items.slice(start, Math.min(start + PER_RUN, total));
    const nextCursor = (start + PER_RUN) % total;

    let sent = 0;
    for (const it of slice) {
      const { ticker, low, high } = it;
      const latest = await getDailyClose(ticker);
      if (!latest || !Number.isFinite(latest.close)) continue;

      const s = scoreLog(latest.close, low, high);
      const z = zoneIndex(s);

      const stateKey = `alert:${ticker}`;
      const prev = (await kv.get(stateKey)) || { lastZone: z, lastEmailAt: 0 };

      if (prev.lastZone !== z) {
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
        await kv.set(stateKey, prev); // ensure key exists
      }
    }

    await kv.set("alert:cursor", nextCursor);
    return res.status(200).json({ processed: slice.length, total, sent, nextCursor });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
