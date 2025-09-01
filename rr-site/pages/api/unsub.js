import { unsubscribe } from "../../lib/subscribers";

export default async function handler(req, res) {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).send("Missing email address.");
    await unsubscribe(email); // moves from subs:active → subs:unsubscribed
    res
      .status(200)
      .send("You're unsubscribed from R/R alerts. You can close this tab.");
  } catch {
    res.status(400).send("Invalid email.");
  }
}
