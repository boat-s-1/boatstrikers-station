import { NextResponse } from "next/server";
import { collectHatsuneNews } from "../../../../lib/hatsuneNewsCollector";
import { generatePendingHatsuneArticles } from "../../../../lib/hatsuneNewsAi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const collection = await collectHatsuneNews();
    let ai = [];
    let aiError = null;

    if (process.env.OPENAI_API_KEY) {
      try {
        ai = await generatePendingHatsuneArticles({ limit: 10 });
      } catch (error) {
        aiError = error?.message || String(error);
      }
    } else {
      aiError = "OPENAI_API_KEY is not configured";
    }

    return NextResponse.json({
      ok: collection.errors.length === 0 && !aiError,
      collection,
      ai: {
        processed: ai.length,
        generated: ai.filter((x) => !x.error && !x.skipped).length,
        errors: ai.filter((x) => x.error),
        pipeline_error: aiError,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
