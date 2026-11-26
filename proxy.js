import crypto from "node:crypto";
import { NextResponse } from "next/server";

// Targeted early denial: the page and API still enforce authorization at the data read.
function validAdminCookie(value) {
  const secret = process.env.ADMIN_DASHBOARD_PASSWORD;
  if (!secret || typeof value !== "string") return false;
  const [rawTime, supplied, extra] = value.split(".");
  if (extra !== undefined || !/^\d+$/.test(rawTime ?? "") || !/^[a-f0-9]{64}$/.test(supplied ?? "")) return false;
  const time = Number(rawTime);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(time) || time > now || now - time > 12 * 60 * 60) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawTime).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export function proxy(request) {
  const preview = request.nextUrl.pathname.startsWith("/admin/program-preview");
  if ((preview && process.env.BS_ADMIN_PROGRAM_PREVIEW_ENABLED !== "true") ||
      !validAdminCookie(request.cookies.get("bs_admin_sync")?.value)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/program-preview/:path*", "/admin/exhibition-data-status/:path*", "/admin/alerts/collection/:path*", "/admin/alerts/exhibition/:path*"] };
