import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

const SESSION_PAYLOAD = "tghc-admin-session";

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function deriveSessionToken(adminPassword) {
  return createHmac("sha256", adminPassword).update(SESSION_PAYLOAD).digest("hex");
}

export function verifyAdminPassword(password) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || typeof password !== "string" || password.length === 0) {
    return false;
  }
  return timingSafeStringEqual(password, adminPassword);
}

export function createAdminSessionToken() {
  return deriveSessionToken(process.env.ADMIN_PASSWORD);
}

export function isValidAdminSessionToken(token) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || typeof token !== "string" || token.length === 0) {
    return false;
  }
  return timingSafeStringEqual(token, deriveSessionToken(adminPassword));
}
