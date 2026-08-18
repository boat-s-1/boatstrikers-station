import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAGAZINE_COOKIE = "bs_magazine_premium";
const allowedMagazines = new Set(["ichika", "hatsune", "kiina"]);

function authSecret() {
  return process.env.BOATSTRIKERS_MAGAZINE_AUTH_SECRET || process.env.BOATSTRIKERS_MAGAZINE_PASSWORD || "";
}

function signature(value) {
  const secret = authSecret();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function verifyMagazineToken(token) {
  if (!token || !authSecret()) return false;
  const [expiresAt, providedSignature] = token.split(".");
  if (!expiresAt || !providedSignature) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;

  const expected = signature(expiresAt);
  if (!expected || expected.length !== providedSignature.length) return false;

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(providedSignature));
}

export async function GET(request) {
  if (!verifyMagazineToken(request.cookies.get(MAGAZINE_COOKIE)?.value)) {
    return NextResponse.json({ error: "Premium認証が必要です。" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const magazine = searchParams.get("magazine") || "";
  const issue = searchParams.get("issue") || "";
  const page = Number(searchParams.get("page"));

  if (!allowedMagazines.has(magazine) || !/^\d{3}$/.test(issue) || !Number.isInteger(page) || page < 5 || page > 99) {
    return NextResponse.json({ error: "ページ指定が不正です。" }, { status: 400 });
  }

  const filename = `page-${String(page).padStart(2, "0")}.png`;
  const filepath = path.join(process.cwd(), "private", "magazines", magazine, issue, filename);

  try {
    const image = await fs.readFile(filepath);
    return new NextResponse(image, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, noarchive"
      }
    });
  } catch {
    return NextResponse.json({ error: "ページが見つかりません。" }, { status: 404 });
  }
}
