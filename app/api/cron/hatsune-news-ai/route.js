import { NextResponse } from "next/server";
import { generatePendingHatsuneArticles } from "../../../../lib/hatsuneNewsAi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY is not configured" },
      { status: 503 },
    );
  }

  try {
    const results = await generatePendingHatsuneArticles({ limit: 5 });
    return NextResponse.json({ ok: true, generated: results.length, results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
