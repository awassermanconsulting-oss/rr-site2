export const config = { api: { bodyParser: false } };

import Stripe from "stripe";
import getRawBody from "raw-body";
import { addSubscriber, removeSubscriber } from "../../../lib/subscribers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const buf = await getRawBody(req);
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = session.customer_details?.email || session.customer_email;
      if (email) await addSubscriber(email);
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const email = sub?.customer_email || sub?.customer_details?.email; // sometimes absent
      const status = sub?.status; // 'active', 'trialing', 'past_due', 'canceled', etc.
      if (email) {
        if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
          await removeSubscriber(email);
        } else {
          await addSubscriber(email);
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const email = sub?.customer_email || sub?.customer_details?.email;
      if (email) await removeSubscriber(email);
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
