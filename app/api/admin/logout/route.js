import { NextResponse } from "next/server";
import { adminCookie } from "../../../admin/sync/_lib/adminAuth";

export async function POST(request) {
  const response = NextResponse.redirect(new URL("/admin-login", request.url), 303);
  response.cookies.set(adminCookie.name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
