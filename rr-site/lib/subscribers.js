import { kv } from "@vercel/kv";

const SET_ACTIVE = "subs:active";

export async function addSubscriber(email) {
  if (!email) return;
  await kv.sadd(SET_ACTIVE, email.toLowerCase());
}

export async function removeSubscriber(email) {
  if (!email) return;
  await kv.srem(SET_ACTIVE, email.toLowerCase());
}

export async function listSubscribers() {
  const members = await kv.smembers(SET_ACTIVE);
  return Array.isArray(members) ? members : [];
}
