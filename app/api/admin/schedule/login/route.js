import { NextResponse } from "next/server";
import {
  createScheduleAdminToken,
  scheduleAdminCookie,
} from "../../../../admin/schedule/_lib/scheduleAdminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readPassword(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    return String(body?.password || "");
  }

  const formData = await request.formData();
  return String(formData.get("password") || "");
}

export async function GET(request) {
  return NextResponse.redirect(
    new URL("/admin/schedule/login", request.url),
    303
  );
}

export async function POST(request) {
  try {
    const password = await readPassword(request);
    const expected =
      process.env.SCHEDULE_ADMIN_PASSWORD ||
      process.env.ADMIN_DASHBOARD_PASSWORD;

    if (!expected) {
      return NextResponse.json(
        {
          error:
            "SCHEDULE_ADMIN_PASSWORD または ADMIN_DASHBOARD_PASSWORD が未設定です。",
        },
        { status: 500 }
      );
    }

    if (!password || password !== expected) {
      return NextResponse.json(
        { error: "パスワードが違います。" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      scheduleAdminCookie.name,
      createScheduleAdminToken(),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: scheduleAdminCookie.maxAge,
      }
    );

    return response;
  } catch (error) {
    console.error("Schedule admin login error:", error);
    return NextResponse.json(
      { error: error.message || "ログイン処理に失敗しました。" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: "GET, POST, OPTIONS" },
  });
}
