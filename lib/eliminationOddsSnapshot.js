import "server-only";
import { createClient } from "@supabase/supabase-js";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} が設定されていません。`);
  return value;
}

function getSupabaseServerClient() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

function getJstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function saveEliminationOddsSnapshot({
  raceDate,
  courseCode,
  raceNo,
  odds,
  oddsCount,
  source = "boatrace_official",
  resultAvailable = false,
}) {
  try {
    if (resultAvailable) return { saved: false, reason: "result_available" };
    if (raceDate !== getJstDateString()) return { saved: false, reason: "not_today" };
    if (!odds || typeof odds !== "object" || Number(oddsCount) < 120) {
      return { saved: false, reason: "odds_incomplete" };
    }

    const supabase = getSupabaseServerClient();
    const { data: latest, error: latestError } = await supabase
      .from("bs_elimination_odds_snapshots")
      .select("captured_at")
      .eq("race_date", raceDate)
      .eq("course_code", Number(courseCode))
      .eq("race_no", Number(raceNo))
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw latestError;

    if (latest?.captured_at) {
      const elapsedMs = Date.now() - new Date(latest.captured_at).getTime();
      if (Number.isFinite(elapsedMs) && elapsedMs < 5 * 60 * 1000) {
        return { saved: false, reason: "recent_snapshot_exists" };
      }
    }

    const { error } = await supabase.from("bs_elimination_odds_snapshots").insert({
      race_date: raceDate,
      course_code: Number(courseCode),
      race_no: Number(raceNo),
      captured_at: new Date().toISOString(),
      source,
      odds,
      odds_count: Number(oddsCount),
    });

    if (error) throw error;
    return { saved: true };
  } catch (error) {
    console.error("elimination odds snapshot save error", error);
    return { saved: false, reason: "error" };
  }
}
