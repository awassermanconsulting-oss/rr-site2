// pages/api/unsub.js
import { unsubscribe } from "../../lib/subscribers";

export default async function handler(req, res) {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).send("Missing email address.");

    await unsubscribe(email); // writes to subs:unsubscribed and removes from subs:active

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`
      <!doctype html>
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:40px auto;padding:24px;border:1px solid #eee;border-radius:12px">
        <h2 style="margin-top:0">You're unsubscribed</h2>
        <p>We'll stop sending R/R alerts to <strong>${email}</strong>.</p>
        <p style="color:#666;font-size:14px">If this was a mistake, you can resubscribe any time by signing up again.</p>
        <p><a href="/" style="text-decoration:none">← Back to RiskRewardCharts</a></p>
      </div>
    `);
  } catch (_e) {
    res.status(400).send("Invalid email.");
  }
}
