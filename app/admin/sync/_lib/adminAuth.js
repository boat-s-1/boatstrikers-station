import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "bs_admin_sync";
const MAX_AGE = 60 * 60 * 12;

function secret() {
  const value = process.env.ADMIN_DASHBOARD_PASSWORD;
  if (!value) throw new Error("ADMIN_DASHBOARD_PASSWORD が未設定です。");
  return value;
}

function signature(timestamp) {
  return crypto.createHmac("sha256", secret()).update(String(timestamp)).digest("hex");
}

export function createAdminToken() {
  const timestamp = Math.floor(Date.now() / 1000);
  return `${timestamp}.${signature(timestamp)}`;
}

export function verifyAdminToken(token) {
  if (!token) return false;
  const [rawTimestamp, rawSignature] = token.split(".");
  const timestamp = Number(rawTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.floor(Date.now() / 1000) - timestamp > MAX_AGE) return false;
  const expected = signature(timestamp);
  if (rawSignature?.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(rawSignature), Buffer.from(expected));
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  return verifyAdminToken(store.get(COOKIE_NAME)?.value);
}

export const adminCookie = { name: COOKIE_NAME, maxAge: MAX_AGE };
