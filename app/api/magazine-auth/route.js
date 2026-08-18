import { NextResponse } from "next/server";
import {
  createMagazineToken,
  MAGAZINE_COOKIE,
  MAGAZINE_COOKIE_MAX_AGE,
  passwordConfigured,
  passwordMatches,
  verifyMagazineToken
} from "../../../lib/magazineAuth";

export const runtime = "nodejs";

export async function GET(request) {
  const authenticated = verifyMagazineToken(request.cookies.get(MAGAZINE_COOKIE)?.value);
  return NextResponse.json({ authenticated, configured: passwordConfigured() }, { headers: { "Cache-Control": "no-store" } });
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
  response.cookies.set({ name: MAGAZINE_COOKIE, value: "", httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
