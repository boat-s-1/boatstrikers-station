import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "bs_schedule_admin";
const MAX_AGE = 60 * 60 * 12;

function getPassword() {
  const value =
    process.env.SCHEDULE_ADMIN_PASSWORD ||
    process.env.ADMIN_DASHBOARD_PASSWORD;

  if (!value) {
    throw new Error(
      "SCHEDULE_ADMIN_PASSWORD または ADMIN_DASHBOARD_PASSWORD が未設定です。"
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

export function createScheduleAdminToken() {
  const timestamp = Math.floor(Date.now() / 1000);
  return `${timestamp}.${sign(timestamp)}`;
}

export function verifyScheduleAdminToken(token) {
  if (!token) return false;
  const [rawTimestamp, rawSignature] = token.split(".");
  const timestamp = Number(rawTimestamp);
  if (!Number.isFinite(timestamp) || !rawSignature) return false;
  if (Math.floor(Date.now() / 1000) - timestamp > MAX_AGE) return false;

  const expected = sign(timestamp);
  if (rawSignature.length !== expected.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(rawSignature),
    Buffer.from(expected)
  );
}

export async function isScheduleAdminAuthenticated() {
  const store = await cookies();
  return verifyScheduleAdminToken(store.get(COOKIE_NAME)?.value);
}

export const scheduleAdminCookie = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE,
};
