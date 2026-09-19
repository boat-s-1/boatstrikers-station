import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { adminCookie, createAdminToken } from "../../../admin/sync/_lib/adminAuth";

function matchesPassword(received, expected) {
  if (!received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function POST(request) {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const expected = process.env.ADMIN_DASHBOARD_PASSWORD || "";
  if (!matchesPassword(password, expected)) {
    return NextResponse.redirect(new URL("/admin-login?error=1", request.url), 303);
  }
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(adminCookie.name, createAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: adminCookie.maxAge,
  });
  return response;
}
