import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SUPABASE_CRON_TOKEN_SHA256 = "8ba9be2c4bdca06f432f838869131995057bc2f482b8ac0bbf1fba9f4ad133aa";

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) return true;
  const token = request.headers.get("x-supabase-cron-token") || "";
  if (!token) return false;
  const digest = crypto.createHash("sha256").update(token).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(SUPABASE_CRON_TOKEN_SHA256));
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数が未設定です");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function exactCount(query) {
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

async function snapshot(supabase, raceDate) {
  const [events, entries, previousPredictions, previousRankings] = await Promise.all([
    exactCount(supabase.from("bs_race_events").select("race_no", { count: "exact", head: true }).eq("race_date", raceDate)),
    exactCount(supabase.from("bs_race_entries").select("boat_no", { count: "exact", head: true }).eq("race_date", raceDate)),
    exactCount(supabase.from("bs_ai_predictions").select("id", { count: "exact", head: true }).eq("race_date", raceDate).eq("timing", "previous_day")),
    exactCount(supabase.from("ai_v2_daily_rankings").select("id", { count: "exact", head: true }).eq("ranking_date", raceDate).eq("data_timing", "previous_day")),
  ]);
  return { events, entries, previousPredictions, previousRankings };
}

async function runPredictionRecovery(request, raceDate) {
  const key = process.env.BSC_AI_ADMIN_KEY;
  if (!key) return { attempted: false, ok: false, reason: "BSC_AI_ADMIN_KEY missing" };
  const url = new URL("/api/ai/generate-predictions", request.url);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bsc-ai-key": key },
    body: JSON.stringify({ date: raceDate }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  return { attempted: true, ok: response.ok, status: response.status, body };
}

async function recordHealth(supabase, raceDate, status, message) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("ai_jobs").insert({
    job_type: "previous_day_health",
    status,
    progress: status === "completed" ? 100 : 0,
    requested_by: "supabase-cron",
    worker_name: "vercel-ai-health",
    message: `${raceDate} ${message}`.slice(0, 1000),
    started_at: now,
    completed_at: now,
    error_message: status === "failed" ? message.slice(0, 1800) : null,
  });
  if (error) console.warn("ai health log insert failed", error.message);
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const raceDate = jstToday();

  try {
    const before = await snapshot(supabase, raceDate);
    let recovery = { attempted: false };

    if (before.entries > 0 && before.previousPredictions === 0) {
      recovery = await runPredictionRecovery(request, raceDate);
    }

    const after = recovery.attempted ? await snapshot(supabase, raceDate) : before;
    const healthy = after.previousPredictions > 0 && after.previousRankings > 0;
    const message = `events=${after.events}, entries=${after.entries}, previous_predictions=${after.previousPredictions}, previous_rankings=${after.previousRankings}`;

    await recordHealth(supabase, raceDate, healthy ? "completed" : "failed", message);

    if (!healthy) {
      console.error("[ai-previous-day-health] unhealthy", { raceDate, before, after, recovery });
    } else {
      console.info("[ai-previous-day-health] healthy", { raceDate, after });
    }

    return NextResponse.json({ ok: healthy, raceDate, before, recovery, after, checkedAt: new Date().toISOString() }, { status: healthy ? 200 : 503 });
  } catch (error) {
    const message = String(error?.message || error);
    await recordHealth(supabase, raceDate, "failed", message);
    return NextResponse.json({ ok: false, raceDate, error: message }, { status: 500 });
  }
}
