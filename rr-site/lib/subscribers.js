// lib/subscribers.js
import { kv } from "@vercel/kv";

export const KEY_ACTIVE = "subs:active";          // existing set (keep as-is)
export const KEY_UNSUB = "subs:unsubscribed";     // new set for opt-outs

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (e) => String(e || "").trim().toLowerCase();

// Return only subscribers who are NOT unsubscribed
export async function listSubscribers() {
  const [active = [], unsub = []] = await Promise.all([
    kv.smembers(KEY_ACTIVE),
    kv.smembers(KEY_UNSUB),
  ]);
  const unsubSet = new Set(unsub.map(norm));
  return active.map(norm).filter((e) => e && !unsubSet.has(e));
}

// Add a subscriber (also removes them from unsub list if they rejoin)
export async function addSubscriber(email) {
  const e = norm(email);
  if (!EMAIL_RE.test(e)) throw new Error("Invalid email");
  await kv.sadd(KEY_ACTIVE, e);
  await kv.srem(KEY_UNSUB, e);
  return e;
}

// Remove from the active set (does NOT mark unsubscribed)
export async function removeSubscriber(email) {
  const e = norm(email);
  await kv.srem(KEY_ACTIVE, e);
  return e;
}

// Mark as unsubscribed (and remove from active)
export async function unsubscribe(email) {
  const e = norm(email);
  if (!EMAIL_RE.test(e)) throw new Error("Invalid email");
  await kv.sadd(KEY_UNSUB, e);
  await kv.srem(KEY_ACTIVE, e);
  return e;
}

// Undo an unsubscribe (keep for admin tools / support)
export async function resubscribe(email) {
  const e = norm(email);
  if (!EMAIL_RE.test(e)) throw new Error("Invalid email");
  await kv.srem(KEY_UNSUB, e);
  await kv.sadd(KEY_ACTIVE, e);
  return e;
}

// Quick check
export async function isUnsubscribed(email) {
  const e = norm(email);
  return !!(await kv.sismember(KEY_UNSUB, e));
}
