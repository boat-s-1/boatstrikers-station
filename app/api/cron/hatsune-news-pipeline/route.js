import { NextResponse } from "next/server";
import { collectHatsuneNews } from "../../../../lib/hatsuneNewsCollector";
import { generatePendingHatsuneArticles } from "../../../../lib/hatsuneNewsAi";
import { startHatsuneCronRun, finishHatsuneCronRun } from "../../../../lib/hatsuneCronLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function arrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let logContext = null;
  try {
    logContext = await startHatsuneCronRun("pipeline");
  } catch (error) {
    console.error("Hatsune cron log start failed", error);
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

    const collectionErrors = Array.isArray(collection?.errors) ? collection.errors : [];
    const inserted = arrayLength(collection?.inserted) || arrayLength(collection?.results?.inserted);
    const skipped = arrayLength(collection?.skipped) || arrayLength(collection?.results?.skipped);
    const collected = Number(collection?.collected || collection?.candidate_count || inserted + skipped || 0);
    const generated = ai.filter((x) => !x.error && !x.skipped).length;
    const aiErrors = ai.filter((x) => x.error);
    const errorCount = collectionErrors.length + aiErrors.length + (aiError ? 1 : 0);
    const ok = errorCount === 0;

    if (logContext) {
      await finishHatsuneCronRun({
        ...logContext,
        status: ok ? "success" : "partial",
        metrics: {
          collected,
          inserted,
          skipped,
          aiProcessed: ai.length,
          aiGenerated: generated,
          errorCount,
        },
        errorMessage: aiError || collectionErrors.map((x) => x?.message || String(x)).join(" | ") || null,
        details: { collection, aiErrors },
      });
    }

    return NextResponse.json({
      ok,
      collection,
      ai: {
        processed: ai.length,
        generated,
        errors: aiErrors,
        pipeline_error: aiError,
      },
    });
  } catch (error) {
    const message = error?.message || String(error);
    if (logContext) {
      await finishHatsuneCronRun({
        ...logContext,
        status: "error",
        metrics: { errorCount: 1 },
        errorMessage: message,
      });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
