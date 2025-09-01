import { kv } from "@vercel/kv";

const KEY = "subs:active";

export async function listSubscribers() {
  const vals = await kv.smembers(KEY);
  return (vals || []).filter(Boolean);
}

export async function addSubscriber(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Invalid email");
  await kv.sadd(KEY, e);
  return e;
}

export async function removeSubscriber(email) {
  const e = String(email || "").trim().toLowerCase();
  await kv.srem(KEY, e);
  return e;
}
