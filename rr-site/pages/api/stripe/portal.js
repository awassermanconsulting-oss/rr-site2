import { kv } from "@vercel/kv";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

export default async function handler(req, res) {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).send("email required");

  const customer = await kv.get(`cust:${email}`);
  if (!customer) return res.status(404).send("No Stripe customer found for this email");

  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: process.env.APP_BASE_URL || "https://riskrewardcharts.com",
  });

  res.writeHead(302, { Location: session.url });
  res.end();
}
