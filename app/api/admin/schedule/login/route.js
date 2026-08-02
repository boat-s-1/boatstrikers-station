import { NextResponse } from "next/server";
import {
  createScheduleAdminToken,
  scheduleAdminCookie,
} from "../../../../admin/schedule/_lib/scheduleAdminAuth";

export async function POST(request) {
  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const expected =
    process.env.SCHEDULE_ADMIN_PASSWORD ||
    process.env.ADMIN_DASHBOARD_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.redirect(
      new URL("/admin/schedule/login?error=1", request.url),
      303
    );
  }

  const response = NextResponse.redirect(
    new URL("/admin/schedule", request.url),
    303
  );
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
}
