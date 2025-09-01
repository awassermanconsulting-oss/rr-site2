import { kv } from "@vercel/kv";
import Stripe from "stripe";
import getRawBody from "raw-body";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const SUBS_KEY = "subs:active";
const UNSUB_KEY = "subs:unsubscribed";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method not allowed");

  let event;
  try {
    const raw = await getRawBody(req);
    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret) return res.status(500).send("Missing webhook secret");
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.log("[stripe] signature verification failed:", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        let email =
          session?.customer_details?.email ||
          session?.customer_email ||
          null;

        // For some zero-dollar checkouts, the email may only be available on the
        // associated customer object, so fetch it if needed.
        if (!email && session?.customer) {
          try {
            const customer = await stripe.customers.retrieve(session.customer);
            email = customer?.email || null;
          } catch (err) {
            console.log(
              "[webhook] failed to retrieve customer:",
              err?.message || err
            );
          }
        }

        if (email) {
          const e = String(email).trim().toLowerCase();
          await kv.sadd(SUBS_KEY, e);
          await kv.srem(UNSUB_KEY, e);
          console.log(`[webhook] added subscriber: ${e}`);

          // Save the Stripe customer id for Billing Portal (works even for $0 checkouts)
          if (session.customer) {
            await kv.set(`cust:${e}`, session.customer);
            await kv.set(`email_by_customer:${session.customer}`, e);
          }
        } else {
          console.log("[webhook] no email on session; skipping");
        }
        break;
      }
      default:
        // ignore others
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.log("[stripe] handler error:", err?.message || err);
    return res.status(500).send("Webhook handler error");
  }
}
