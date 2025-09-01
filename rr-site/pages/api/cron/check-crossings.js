// Per-ticker zone-change alerts with a 7-day cooldown (at most 1 email per ticker per week).
// Uses Vercel KV to remember last zone + last email time.
// Sends ONE email per subscriber with a personalized unsubscribe link.

import { kv } from "@vercel/kv";
import { Resend } from "resend";
import { listSubscribers } from "../../../lib/subscribers";

// ---------- helpers ----------
function priceAtScore(low, high, s) {
  // s in [0..10]; p = high / (high/low)^(s/10)
  const ratio = high / low;
  return high / Math.pow(ratio, s / 10);
}

// Price direction (not zone-index direction): lower zone-index => price UP
function priceDirection(fromZone, toZone) {
  if (toZone < fromZone) return "UP";
  if (toZone > fromZone) return "DOWN";
  return "FLAT";
}

// Return the score line crossed (one of 10, 7, 5, 3, 0) or null
function crossedBoundary(fromZone, toZone) {
  if (fromZone === toZone) return null;
  const step = toZone > fromZone ? 1 : -1;
  // Map "upper" zone index of the boundary to its score line
  // Boundaries between:
  // 5↔4 => 10, 4↔3 => 7, 3↔2 => 5, 2↔1 => 3, 1↔0 => 0
  const zoneEdgeToScore = { 5: 10, 4: 7, 3: 5, 2: 3, 1: 0 };
  const upperSide = (toZone > fromZone ? toZone : fromZone) - (step > 0 ? 0 : 1);
  return zoneEdgeToScore[upperSide] ?? null;
}

function zoneName(idx) {
  // 0..5 (low->high scores)
  return ["OUT", "Sell Zone", "Above Halfway Point", "Below Halfway Point", "Buy Zone", "BUY"][idx];
}

// ---- scoring / zones ----
function scoreLog(price, low, high) {
  const p = Math.max(Math.min(price, high), low);
  const s = 10 * (Math.log(high / p) / Math.log(high / low));
  return Math.max(0, Math.min(10, s));
}

// New 6-zone scheme:
// 10 -> BUY (idx 5)
// [7, 9.999...] -> Buy Zone (idx 4)
// [5, 7) -> Below Halfway (idx 3)
// [3, 5) -> Above Halfway (idx 2)
// (0, 3) -> Sell Zone (idx 1)
// 0 -> OUT (idx 0)
function zoneIndex(s) {
  if (s >= 9.999) return 5;      // 10 (BUY)
  if (s >= 7)     return 4;      // 9.99–7
  if (s >= 5)     return 3;      // 6.99–5
  if (s >= 3)     return 2;      // 5–3
  if (s > 0)      return 1;      // 2.99–0
  return 0;                      // 0 (OUT)
}

// ---------- config ----------
const ALPHA = process.env.ALPHA_VANTAGE_KEY;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PER_RUN = 6; // keep small to respect Alpha Vantage free tier
const resend = new Resend(process.env.RESEND_API_KEY);

// ---------- market data (daily + fallback) ----------
async function getDailyClose(symbol) {
  const base = "https://www.alphavantage.co/query";
  const paramsDaily = `function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA}&outputsize=compact`;
  const r = await fetch(`${base}?${paramsDaily}`, { cache: "no-store" });
  const j = await r.json();

  if (j["Time Series (Daily)"]) {
    const [date, row] = Object.entries(j["Time Series (Daily)"])[0];
    return { date, close: Number(row["4. close"]) };
  }

  if (j["Note"] || j["Information"]) {
    console.log(`[alpha] rate-limited/info for ${symbol}: ${(j["Note"] || j["Information"]).slice(0, 80)}…`);
    return { rateLimited: true };
  }

  // fallback: GLOBAL_QUOTE
  const paramsGq = `function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA}`;
  const r2 = await fetch(`${base}?${paramsGq}`, { cache: "no-store" });
  const j2 = await r2.json();
  const g = j2["Global Quote"];
  if (g && g["05. price"]) {
    const date = new Date().toISOString().slice(0, 10);
    return { date, close: Number(g["05. price"]) };
  }
  console.log(`[alpha] no data for ${symbol}; keys=${Object.keys(j).join(",")}`);
  return null;
}

// ---------- email ----------
async function maybeEmail({ ticker, fromZone, toZone, price, date, low, high }) {
  const stateKey = `alert:${ticker}`;
  const last = (await kv.get(stateKey)) || { lastZone: null, lastEmailAt: 0 };
  const now = Date.now();
  const onCooldown = now - (last.lastEmailAt || 0) < COOLDOWN_MS;

  let newState = { lastZone: toZone, lastEmailAt: last.lastEmailAt };
  let sent = false;

  if (!onCooldown && process.env.RESEND_API_KEY && process.env.ALERT_FROM) {
    const recipients = (await listSubscribers()).filter(Boolean);
    if (!recipients.length) {
      console.log("[email] no active subscribers; skipping send");
    } else {
      const direction = priceDirection(fromZone, toZone); // "UP" | "DOWN"
      const boundary = crossedBoundary(fromZone, toZone); // 10 | 7 | 5 | 3 | 0 | null
      const boundaryPrice = Number.isFinite(boundary) ? priceAtScore(low, high, boundary) : null;

      const fromLabel = zoneName(fromZone);
      const toLabel   = zoneName(toZone);
      const subject   = `R/R alert: ${ticker} moved ${direction} in price into ${toLabel}`;

      console.log(`[email] ${ticker}: from=${process.env.ALERT_FROM} to=[${recipients.join(", ")}]`);

      let delivered = 0;
      for (const rcpt of recipients) {
        const unsubLink = `https://riskrewardcharts.com/api/unsub?email=${encodeURIComponent(rcpt)}`;

        const html = `
          <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
            <h2 style="margin:0 0 8px 0">${ticker} moved ${direction} in price</h2>
            <p style="margin:0 0 6px 0"><strong>From:</strong> ${fromLabel}</p>
            <p style="margin:0 0 6px 0"><strong>To:</strong> ${toLabel}</p>
            ${
              Number.isFinite(boundary) && boundaryPrice
                ? `<p style="margin:0 0 6px 0"><strong>Crossed:</strong> ${boundary}-line near ~$${boundaryPrice.toFixed(2)}</p>`
                : ""
            }
            <p style="margin:0 0 6px 0"><strong>Latest close:</strong> $${price.toFixed(2)} <span style="color:#666">(as of ${date})</span></p>
            <hr style="border:none;border-top:1px solid #ddd;margin:12px 0" />
            <p style="font-size:12px;color:#666;margin:0">
              Max one alert per ticker per 7 days. Not investment advice.
              <br>
              <a href="${unsubLink}" style="color:#666">Unsubscribe</a>
            </p>
          </div>`;

        try {
          const resp = await resend.emails.send({
            from: process.env.ALERT_FROM,
            to: rcpt, // send INDIVIDUALLY
            subject,
            html,
          });
          console.log(`[resend] accepted id=${resp?.id || 'n/a'} to=${rcpt}`);
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
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN)
      return res.status(500).json({ error: "Vercel KV env vars missing" });

    const origin = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
    const listResp = await fetch(`${origin}/api/tickers`, { cache: "no-store" });
    const { items = [] } = await listResp.json();
    if (!items.length) return res.status(200).json({ processed: 0, sent: 0 });

    // Optional override: run all once for manual tests: /api/cron/check-crossings?all=1
    const forceAll = (req.query?.all === "1" || req.query?.all === "true");

    const total = items.length;
    const start = forceAll ? 0 : (Number((await kv.get("alert:cursor")) || 0));
    const per   = forceAll ? total : Math.min(PER_RUN, total);
    const end   = start + per;

    // wrap-around slice
    const slice = end <= total
      ? items.slice(start, end)
      : [...items.slice(start, total), ...items.slice(0, end - total)];

    let nextCursor = (start + per) % total;
    console.log(`[cron] processing ${slice.length}/${total} (cursor ${start} → ${nextCursor})`);

    let sent = 0;
    let hitRateLimit = false;

    for (const it of slice) {
      const { ticker, low, high } = it;
      let sheetPrice = Number.isFinite(it?.price) ? Number(it.price) : null;

      console.log(`[check] ${ticker}: low=${low}, high=${high}, sheetPrice=${sheetPrice ?? "n/a"}`);

      // Use Google Sheet price first if present; else call Alpha Vantage
      let latest;
      if (Number.isFinite(sheetPrice)) {
        latest = { date: new Date().toISOString().slice(0, 10), close: sheetPrice };
      } else {
        if (!ALPHA) {
          console.log(`[check] ${ticker}: no sheet price and ALPHA_VANTAGE_KEY missing`);
          continue;
        }
        latest = await getDailyClose(ticker);
        if (!latest) {
          console.log(`[check] ${ticker}: no data after fallback`);
          continue;
        }
        if (latest.rateLimited) {
          hitRateLimit = true;
          console.log(`[rate-limit] stopping early; will retry same window next run`);
          break;
        }
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

    // If rate-limited, DO NOT advance cursor so we retry same window next time
    if (hitRateLimit && !forceAll) {
      nextCursor = start;
    }

    await kv.set("alert:cursor", nextCursor);
    console.log(`[cron] done: emails sent=${sent}, rate_limited=${hitRateLimit}`);
    return res.status(200).json({ processed: slice.length, total, sent, nextCursor, rate_limited: hitRateLimit });
  } catch (e) {
    console.log(`[error] ${e?.message || e}`);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
