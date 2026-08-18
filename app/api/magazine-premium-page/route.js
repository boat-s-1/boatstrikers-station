import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "bs_magazine_access";
const ALLOWED_MAGAZINES = new Set(["ichika", "hatsune", "kiina"]);

function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const [expText, signature] = token.split(".");
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000) || !signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(String(exp)).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(request) {
  try {
    const secret = process.env.BOATSTRIKERS_MAGAZINE_AUTH_SECRET;
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!verifyToken(token, secret)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const magazine = searchParams.get("magazine") || "";
    const issue = searchParams.get("issue") || "";
    const pageText = searchParams.get("page") || "";
    const pageNumber = Number(pageText);

    if (
      !ALLOWED_MAGAZINES.has(magazine) ||
      !/^\d{3}$/.test(issue) ||
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > 99
    ) {
      return new NextResponse("Bad Request", { status: 400 });
    }

    const filename = `page-${String(pageNumber).padStart(2, "0")}.png`;
    const root = path.join(process.cwd(), "private", "magazines");
    const filePath = path.join(root, magazine, issue, filename);
    const resolved = path.resolve(filePath);
    const resolvedRoot = path.resolve(root) + path.sep;

    if (!resolved.startsWith(resolvedRoot)) {
      return new NextResponse("Bad Request", { status: 400 });
    }

    const data = await fs.readFile(resolved);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return new NextResponse("Not Found", { status: 404 });
    }
    console.error("[magazine-premium-page]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
