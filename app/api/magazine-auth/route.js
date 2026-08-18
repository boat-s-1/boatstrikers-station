import crypto from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAGAZINE_COOKIE = "bs_magazine_premium";
const MAGAZINE_COOKIE_MAX_AGE = 60 * 60 * 24 * 31;

function authSecret() {
  return process.env.BOATSTRIKERS_MAGAZINE_AUTH_SECRET || process.env.BOATSTRIKERS_MAGAZINE_PASSWORD || "";
}

function signature(value) {
  const secret = authSecret();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function createMagazineToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + MAGAZINE_COOKIE_MAX_AGE;
  const payload = String(expiresAt);
  return `${payload}.${signature(payload)}`;
}

function verifyMagazineToken(token) {
  if (!token || !authSecret()) return false;
  const [expiresAt, providedSignature] = token.split(".");
  if (!expiresAt || !providedSignature) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;

  const expected = signature(expiresAt);
  if (!expected || expected.length !== providedSignature.length) return false;

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(providedSignature));
}

function passwordConfigured() {
  return Boolean(process.env.BOATSTRIKERS_MAGAZINE_PASSWORD);
}

function passwordMatches(input) {
  const expected = process.env.BOATSTRIKERS_MAGAZINE_PASSWORD || "";
  if (!expected || typeof input !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(input);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function GET(request) {
  const authenticated = verifyMagazineToken(request.cookies.get(MAGAZINE_COOKIE)?.value);
  return NextResponse.json(
    { authenticated, configured: passwordConfigured() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request) {
  if (!passwordConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Vercelの環境変数 BOATSTRIKERS_MAGAZINE_PASSWORD を設定してください。" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if (!passwordMatches(body.password)) {
    return NextResponse.json({ ok: false, error: "パスワードが違います。" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, authenticated: true });
  response.cookies.set({
    name: MAGAZINE_COOKIE,
    value: createMagazineToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAGAZINE_COOKIE_MAX_AGE
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: MAGAZINE_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
