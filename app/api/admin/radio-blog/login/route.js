import { NextResponse } from "next/server";
import {
  createAdminToken,
  getAdminCookieName,
  getAdminCookieOptions,
} from "../../../../../lib/radioBlogAdminAuth";

export async function POST(request) {
  try {
    const { password } = await request.json();

    if (
      !process.env.RADIO_BLOG_ADMIN_PASSWORD ||
      password !== process.env.RADIO_BLOG_ADMIN_PASSWORD
    ) {
      return NextResponse.json(
        { error: "パスワードが違います。" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      getAdminCookieName(),
      createAdminToken(),
      getAdminCookieOptions()
    );
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "ログインに失敗しました。" },
      { status: 500 }
    );
  }
}
