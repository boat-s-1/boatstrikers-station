import { NextResponse } from "next/server";
import {
  generateAndSaveHatsuneArticle,
  generatePendingHatsuneArticles,
} from "../../../../../lib/hatsuneNewsAi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const secret = process.env.HATSUNE_NEWS_ADMIN_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    if (body?.id) {
      const result = await generateAndSaveHatsuneArticle(body.id, { force: Boolean(body.force) });
      return NextResponse.json({ ok: true, mode: "single", result });
    }

    const results = await generatePendingHatsuneArticles({ limit: body?.limit || 5 });
    return NextResponse.json({ ok: true, mode: "pending", results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
