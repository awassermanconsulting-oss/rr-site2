import crypto from "crypto";

const secret = process.env.UNSUBSCRIBE_SECRET || "dev-secret";

export function makeUnsubToken(email) {
  return crypto.createHmac("sha256", secret).update(email).digest("hex");
}

export function verifyUnsubToken(email, token) {
  const good = makeUnsubToken(email);
  try {
    return crypto.timingSafeEqual(Buffer.from(good), Buffer.from(String(token || "")));
  } catch {
    return false;
  }
}

export function unsubLink(baseUrl, email) {
  const e = String(email).trim().toLowerCase();
  const t = makeUnsubToken(e);
  return `${baseUrl}/api/unsubscribe?e=${encodeURIComponent(e)}&t=${t}`;
}
