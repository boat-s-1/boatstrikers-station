import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "radio_blog_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function getSecret() {
  const secret = process.env.RADIO_BLOG_ADMIN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "RADIO_BLOG_ADMIN_SECRET は32文字以上で設定してください。"
    );
  }
  return secret;
}

function sign(value) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("hex");
}

export function createAdminToken() {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== "string") return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (Number(payload) <= Date.now()) return false;

  const expected = sign(payload);
  if (signature.length !== expected.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export async function isRadioBlogAdmin() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get(COOKIE_NAME)?.value);
}

export async function requireRadioBlogAdmin() {
  if (!(await isRadioBlogAdmin())) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
}

export function getAdminCookieName() {
  return COOKIE_NAME;
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}
