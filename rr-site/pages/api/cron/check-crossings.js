// pages/api/cron/check-crossings.js

// Per-ticker zone-change alerts with a 7-day cooldown.
// Stores the latest close/date in KV so the UI can read prices without
// hammering Alpha Vantage (fixes "loading..." in the table).

import { kv } from "@vercel/kv";
import { Resend } from "resend";
import { listSubscribers } from "../../../lib/subscribers";

// ---------- helpers ----------
function priceAtScore(low, high, s) {
  const ratio = high / low;
  return high / Math.pow(ratio, s / 10);
}

// PRICE direction (not zone-index direction): lower zone index = price UP.
function priceDirection(fromZone, toZone) {
  if (toZone < fromZone) return "UP";
  if (toZone > fromZone) return "DOWN";
  return "FLAT";
}

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

function scoreLog(price, low, high) {
  const p = Math.max(Math.min(price, high), low);
  const s = 10 * (Math.log(high / p) / Math.log(high / low));
  return Math.max(0, Math.min(10, s));
}

function zoneIndex(s) {
  if (s >= 7) return 3; // 10–7
  if (s >= 5) return 2; // 7–5
  if (s >= 2) return 1; // 5–2
  return 0;            // 2–0
}

// ---------- config ----------
const ALPHA = process.env.ALPHA_VANTAGE_KEY;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PER_RUN = 4; // keep under Alpha free 5/min
const resend = new Resend(process.env.RESEND_API_KEY);

// ---------- market data with fallback ----------
async function getDailyClose(symbol) {
  const base = "https://www.alphavantage.co/query";

  // Primary: TIME_SERIES_DAILY
  const r = await fetch(
    `${base}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA}&outputsize=compact`,
    { cache: "no-store" }
  );
  const j = await r.json();

  if (j["Time Series (Daily)"]) {
    const [date, row] = Object.entries(j["Time Series (Daily)"])[0];
    return { date, close: Number(row["4. close"]) };
  }

  if (j["Note"] || j["Information"]) {
    console.log(`[alpha] rate-limited/info for ${symbol}: ${(j["Note"] || j["Information"]).slice(0, 80)}…`);
    return { rateLimited: true };
  }

  // Fallback: GLOBAL_QUOTE (many symbols, incl. some OTC)
  const r2 = await fetch(
    `${base}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA}`,
    { cache: "no-store" }
  );
  const j2 = await r2.json();
  const g = j2["Global Quote"];
  if (g && g["05. price"]) {
    const date = new Date().toISOString().slice(0, 10);
    return { date, close: Number(g["05. price"]) };
  }

  console.log(`[alpha] no data for ${symbol}; daily keys: ${Object.keys(j).join(",")} | gq keys: ${Object.keys(j2).join(",")}`);
  return null;
}

// ---------- email ----------
async function maybeEmail({ ticker, fromZone, toZone, price, date, low, high }) {
  const stateKey = `alert:${ticker}`;
  const last = (await kv.get(stateKey)) || { lastZone: null, lastEmailAt: 0 };
  const now = Date.now();
  const onCooldown = now - (last.lastEmailAt || 0) < COOLDOWN_MS;

  // always carry forward latest close/date so UI can read from KV
  let newState = {
    lastZone: toZone,
    lastEmailAt: last.lastEmailAt,
    lastClose: price,
    lastDate: date,
  };

  let sent = false;

  if (!onCooldown && process.env.RESEND_API_KEY && process.env.ALERT_FROM) {
    const recipients = (await listSubscribers()).filter(Boolean);
    if (!recipients.length) {
      console.log("[email] no active subscribers; skipping send");
    } else {
      const direction = priceDirection(fromZone, toZone);
      const boundary = crossedBoundary(fromZone, toZone);
      const boundaryPrice = boundary ? priceAtScore(low, high, boundary) : null;

      const fromLabel = zoneName(fromZone);
      const toLabel = zoneName(toZone);

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
        console.log(`[email] ${ticker}: from=${process.env.ALERT_FROM} key=${(process.env.RESEND_API_KEY || "").slice(0, 8)}…`);

        // Send individually for better deliverability & clearer logs
        let delivered = 0;
        for (const rcpt of recipients) {
          try {
            const resp = await resend.emails.send({
              from: process.env.ALERT_FROM,
              to: rcpt,
              subject,
              html,
            });
            console.log(`[resend] accepted id=${resp?.id || "n/a"} to=${rcpt}`);
            delivered++;
          } catch (err) {
            console.log(`[resend] FAIL to=${rcpt} -> ${err?.message || err}`);
          }
        }

        if (delivered > 0) {
          newState.lastEmailAt = now;
          sent = true;
          console.log(`[email] ${ticker}: delivered=${delivered}/${recipients.length}`);
        } else {
          console.log(`[email] ${ticker}: delivered=0/${recipients.length}`);
        }
      } catch (e) {
        console.log(`[email] ${ticker}: FAILED -> ${e?.message || e}`);
        // keep lastEmailAt unchanged so we can retry later
      }
    }
  } else if (onCooldown) {
    console.log(`[cooldown] ${ticker}: within 7 days, no email`);
  }

  await kv.set(stateKey, newState);
  return sent;
}

// ---------- handler ----------
export default async function handler(req, res) {
  try {
    if (!ALPHA) return res.status(500).json({ error: "Missing ALPHA_VANTAGE_KEY" });
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN)
      return res.status(500).json({ error: "Vercel KV env vars missing" });

    const origin = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
    const listResp = await fetch(`${origin}/api/tickers`, { cache: "no-store" });
    const { items = [] } = await listResp.json();
    if (!items.length) return res.status(200).json({ processed: 0, sent: 0 });

    // Manual override to process all at once: /api/cron/check-crossings?all=1
    const forceAll = req.query?.all === "1" || req.query?.all === "true";

    const total = items.length;
    const start = forceAll ? 0 : Number((await kv.get("alert:cursor")) || 0);
    const per = forceAll ? total : Math.min(PER_RUN, total);
    const end = start + per;

    // wrap-around slice
    const slice =
      end <= total
        ? items.slice(start, end)
        : [...items.slice(start, total), ...items.slice(0, end - total)];

    let nextCursor = (start + per) % total;

    console.log(`[cron] processing ${slice.length}/${total} (cursor ${start} → ${nextCursor})`);

    let sent = 0;
    let hitRateLimit = false;

    for (const it of slice) {
      const { ticker, low, high } = it;
      console.log(`[check] ${ticker}: low=${low}, high=${high}`);

      const latest = await getDailyClose(ticker);
      if (!latest) {
        console.log(`[check] ${ticker}: no data after fallback`);
        continue;
      }
      if (latest.rateLimited) {
        hitRateLimit = true;
        console.log(`[rate-limit] stopping early; will retry same window next run`);
        break;
      }

      const s = scoreLog(latest.close, low, high);
      const z = zoneIndex(s);
      console.log(
        `[score] ${ticker}: close=$${latest.close.toFixed(2)} score=${s.toFixed(2)} zone=${zoneName(z)}`
      );

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
        // even if zone didn't change, store the fresh close/date for the UI
        await kv.set(stateKey, {
          lastZone: z,
          lastEmailAt: prev.lastEmailAt || 0,
          lastClose: latest.close,
          lastDate: latest.date,
        });
        console.log(`[steady] ${ticker}: still ${zoneName(z)}`);
      }
    }

    // If rate-limited, keep cursor where it is so we retry the same window
    if (hitRateLimit && !forceAll) nextCursor = start;

    await kv.set("alert:cursor", nextCursor);
    console.log(`[cron] done: emails sent=${sent}, rate_limited=${hitRateLimit}`);
    return res
      .status(200)
      .json({ processed: slice.length, total, sent, nextCursor, rate_limited: hitRateLimit });
  } catch (e) {
    console.log(`[error] ${e?.message || e}`);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
