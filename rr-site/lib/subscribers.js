import { kv } from "@vercel/kv";

export const KEY_ACTIVE = "subs:active";
export const KEY_UNSUB  = "subs:unsubscribed";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (e) => String(e || "").trim().toLowerCase();

export async function listSubscribers() {
  const [active = [], unsub = []] = await Promise.all([
    kv.smembers(KEY_ACTIVE),
    kv.smembers(KEY_UNSUB),
  ]);
  const unsubSet = new Set(unsub.map(norm));
  return active.map(norm).filter((e) => e && !unsubSet.has(e));
}

export async function addSubscriber(email) {
  const e = norm(email);
  if (!EMAIL_RE.test(e)) throw new Error("Invalid email");
  await kv.sadd(KEY_ACTIVE, e);
  await kv.srem(KEY_UNSUB, e);
  return e;
}

export async function removeSubscriber(email) {
  const e = norm(email);
  await kv.srem(KEY_ACTIVE, e);
  return e;
}

export async function unsubscribe(email) {
  const e = norm(email);
  if (!EMAIL_RE.test(e)) throw new Error("Invalid email");
  await kv.sadd(KEY_UNSUB, e);
  await kv.srem(KEY_ACTIVE, e);
  return e;
}

export async function resubscribe(email) {
  const e = norm(email);
  if (!EMAIL_RE.test(e)) throw new Error("Invalid email");
  await kv.srem(KEY_UNSUB, e);
  await kv.sadd(KEY_ACTIVE, e);
  return e;
}

export async function isUnsubscribed(email) {
  const e = norm(email);
  return !!(await kv.sismember(KEY_UNSUB, e));
}
