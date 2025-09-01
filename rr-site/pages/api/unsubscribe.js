import { kv } from "@vercel/kv";
import { verifyUnsubToken } from "../../lib/unsub";

export default async function handler(req, res) {
  const email = String(req.query.e || "").trim().toLowerCase();
  const token = String(req.query.t || "");
  if (!email || !verifyUnsubToken(email, token)) {
    res.status(400).send("Invalid or expired unsubscribe link.");
    return;
  }
  await kv.srem("subs:active", email);
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.status(200).send(`
    <html><body style="font-family:system-ui;max-width:560px;margin:40px auto">
      <h2>Unsubscribed</h2>
      <p><b>${email}</b> will no longer receive alerts.</p>
      <p><a href="/">Return to site</a></p>
    </body></html>
  `);
}
