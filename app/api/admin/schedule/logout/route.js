import { NextResponse } from "next/server";
import { scheduleAdminCookie } from "../../../../admin/schedule/_lib/scheduleAdminAuth";

export const dynamic = "force-dynamic";

function clearCookie(response) {
  response.cookies.set(scheduleAdminCookie.name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(request) {
  return clearCookie(
    NextResponse.redirect(
      new URL("/admin/schedule/login", request.url),
      303
    )
  );
}

export async function POST(request) {
  return clearCookie(
    NextResponse.redirect(
      new URL("/admin/schedule/login", request.url),
      303
    )
  );
}
