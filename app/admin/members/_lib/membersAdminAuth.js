import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "bs_members_admin";
const MAX_AGE = 60 * 60 * 12;

function getPassword() {
  const value =
    process.env.MEMBERS_ADMIN_PASSWORD ||
    process.env.ADMIN_DASHBOARD_PASSWORD ||
    process.env.SCHEDULE_ADMIN_PASSWORD;

  if (!value) {
    throw new Error(
      "MEMBERS_ADMIN_PASSWORD / ADMIN_DASHBOARD_PASSWORD / SCHEDULE_ADMIN_PASSWORD のいずれかを設定してください。"
    );
  }
  return value;
}

function sign(timestamp) {
  return crypto
    .createHmac("sha256", getPassword())
    .update(String(timestamp))
    .digest("hex");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyMembersAdminPassword(password) {
  return safeEqual(password, getPassword());
}

export function createMembersAdminToken() {
  const timestamp = Math.floor(Date.now() / 1000);
  return `${timestamp}.${sign(timestamp)}`;
}

export function verifyMembersAdminToken(token) {
  if (!token) return false;
  const [rawTimestamp, rawSignature] = String(token).split(".");
  const timestamp = Number(rawTimestamp);
  if (!Number.isFinite(timestamp) || !rawSignature) return false;
  if (Math.floor(Date.now() / 1000) - timestamp > MAX_AGE) return false;
  return safeEqual(rawSignature, sign(timestamp));
}

export async function isMembersAdminAuthenticated() {
  const store = await cookies();
  return verifyMembersAdminToken(store.get(COOKIE_NAME)?.value);
}

export async function setMembersAdminCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, createMembersAdminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearMembersAdminCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
