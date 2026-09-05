import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { collectHatsuneNews } from "../../../../lib/hatsuneNewsCollector";
import { syncHatsuneMediaNews } from "../../../../lib/hatsuneMediaNewsSync";
import { syncBoatstrikersGeneralNews } from "../../../../lib/boatstrikersGeneralNewsSync";
import { generatePendingHatsuneArticles } from "../../../../lib/hatsuneNewsAi";
import { startHatsuneCronRun, finishHatsuneCronRun } from "../../../../lib/hatsuneCronLog";
import { ensureHatsuneDailyMinimum } from "../../../../lib/hatsuneDailyFallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

async function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) return true;

  const schedulerToken = request.headers.get("x-hatsune-scheduler-token");
  if (!schedulerToken) return false;

  const supabase = getAdminSupabase();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase
      .from("hatsune_scheduler_config")
      .select("token")
      .eq("id", "primary")
      .maybeSingle();

    if (error || !data?.token) return false;
    return safeEqual(schedulerToken, data.token);
  } catch {
    return false;
  }
}

function countValue(value) {
  if (Array.isArray(value)) return value.length;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request) {
  if (!(await isAuthorized(request))) {
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
    let media = { found: 0, inserted: 0, skipped: 0, errors: [] };
    let mediaError = null;
    let general = { found: 0, inserted: 0, skipped: 0, errors: [] };
    let generalError = null;

    try {
      media = await syncHatsuneMediaNews();
    } catch (error) {
      mediaError = error?.message || String(error);
    }

    try {
      general = await syncBoatstrikersGeneralNews();
    } catch (error) {
      generalError = error?.message || String(error);
    }

    const baseInserted = countValue(collection?.inserted) || countValue(collection?.results?.inserted);
    const mediaInserted = countValue(media?.inserted);
    const generalInserted = countValue(general?.inserted);

    let fallback = null;
    let fallbackError = null;

    // 初音NEWSの日次最低1件は一般ニュースとは別に維持する。
    if (baseInserted + mediaInserted === 0) {
      try {
        fallback = await ensureHatsuneDailyMinimum();
      } catch (error) {
        fallbackError = error?.message || String(error);
      }
    }

    let ai = [];
    let aiError = null;

    if (process.env.OPENAI_API_KEY) {
      try {
        ai = await generatePendingHatsuneArticles({ limit: 4 });
      } catch (error) {
        aiError = error?.message || String(error);
      }
    } else {
      aiError = "OPENAI_API_KEY is not configured";
    }

    const collectionErrors = Array.isArray(collection?.errors) ? collection.errors : [];
    const mediaErrors = Array.isArray(media?.errors) ? media.errors : [];
    const generalErrors = Array.isArray(general?.errors) ? general.errors : [];
    const fallbackInserted = fallback?.inserted ? 1 : 0;
    const inserted = baseInserted + mediaInserted + generalInserted + fallbackInserted;
    const skipped =
      (countValue(collection?.skipped) || countValue(collection?.results?.skipped)) +
      countValue(media?.skipped) +
      countValue(general?.skipped);
    const found =
      countValue(collection?.official?.found) +
      countValue(collection?.raceData?.found) +
      countValue(media?.found) +
      countValue(general?.found);
    const collected = countValue(collection?.collected) || countValue(collection?.candidate_count) || found || inserted + skipped;
    const generated = ai.filter((x) => !x.error && !x.skipped).length;
    const aiErrors = ai.filter((x) => x.error);
    const errorCount =
      collectionErrors.length +
      mediaErrors.length +
      generalErrors.length +
      aiErrors.length +
      (aiError ? 1 : 0) +
      (mediaError ? 1 : 0) +
      (generalError ? 1 : 0) +
      (fallbackError ? 1 : 0);
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
        errorMessage:
          aiError ||
          mediaError ||
          generalError ||
          fallbackError ||
          [...collectionErrors, ...mediaErrors, ...generalErrors].map((x) => x?.message || String(x)).join(" | ") ||
          null,
        details: { collection, media, mediaError, general, generalError, fallback, fallbackError, aiErrors },
      });
    }

    return NextResponse.json({
      ok,
      collection,
      media,
      media_error: mediaError,
      general,
      general_error: generalError,
      fallback,
      fallback_error: fallbackError,
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
