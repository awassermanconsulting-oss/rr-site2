import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "missing email" });
  await kv.sadd("unsubscribed", email);
  res.status(200).send("You're unsubscribed from R/R alerts. You can close this tab.");
}
