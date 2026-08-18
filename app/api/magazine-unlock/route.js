import crypto from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "bs_magazine_access";
const MAX_AGE = 60 * 60 * 24 * 31;

function sign(exp, secret) {
  return crypto.createHmac("sha256", secret).update(String(exp)).digest("base64url");
}

export async function POST(request) {
  try {
    const password = process.env.BOATSTRIKERS_MAGAZINE_PASSWORD;
    const secret = process.env.BOATSTRIKERS_MAGAZINE_AUTH_SECRET;

    if (!password || !secret) {
      return NextResponse.json(
        { ok: false, message: "Premium認証の環境変数が未設定です。" },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const input = typeof body.password === "string" ? body.password : "";

    const a = Buffer.from(input);
    const b = Buffer.from(password);
    const matches = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!matches) {
      return NextResponse.json(
        { ok: false, message: "パスワードが違います。" },
        { status: 401 }
      );
    }

    const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
    const token = `${exp}.${sign(exp, secret)}`;
    const response = NextResponse.json({ ok: true });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("[magazine-unlock]", error);
    return NextResponse.json(
      { ok: false, message: "認証処理でエラーが発生しました。" },
      { status: 500 }
    );
  }
}
