import { NextResponse } from "next/server";
import { generatePendingHatsuneArticles } from "../../../../lib/hatsuneNewsAi";
import { startHatsuneCronRun, finishHatsuneCronRun } from "../../../../lib/hatsuneCronLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let logContext = null;
  try {
    logContext = await startHatsuneCronRun("ai");
  } catch (error) {
    console.error("Hatsune cron log start failed", error);
  }

  if (!process.env.OPENAI_API_KEY) {
    const message = "OPENAI_API_KEY is not configured";
    if (logContext) {
      await finishHatsuneCronRun({
        ...logContext,
        status: "error",
        metrics: { errorCount: 1 },
        errorMessage: message,
      });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }

  try {
    const results = await generatePendingHatsuneArticles({ limit: 5 });
    const generated = results.filter((x) => !x?.error && !x?.skipped).length;
    const errors = results.filter((x) => x?.error);
    const status = errors.length ? "partial" : "success";

    if (logContext) {
      await finishHatsuneCronRun({
        ...logContext,
        status,
        metrics: {
          aiProcessed: results.length,
          aiGenerated: generated,
          errorCount: errors.length,
        },
        errorMessage: errors.map((x) => x?.error).filter(Boolean).join(" | ") || null,
        details: { errors },
      });
    }

    return NextResponse.json({ ok: errors.length === 0, generated, results });
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
