import { NextResponse } from "next/server";
import { scheduleAdminCookie } from "../../../../admin/schedule/_lib/scheduleAdminAuth";

export async function POST(request) {
  const response = NextResponse.redirect(
    new URL("/admin/schedule/login", request.url),
    303
  );
  response.cookies.set(scheduleAdminCookie.name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
