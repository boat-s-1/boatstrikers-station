import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchBoatersOriginalTenji } from "../../../../lib/boatersOriginalTenji";
import { fetchOfficialOriginalTenji, getOfficialOriginalTenjiSupport } from "../../../../lib/officialOriginalTenji";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function summarize(result) {
  const rows = result?.rows || [];
  return {
    ok: Boolean(result?.ok),
    status: result?.status ?? null,
    error: result?.error ?? null,
    reason: result?.reason ?? null,
    url: result?.url ?? null,
    rows: rows.length,
    lapRows: rows.filter((r) => r.lapTime != null).length,
    turnRows: rows.filter((r) => r.turnTime != null).length,
    straightRows: rows.filter((r) => r.straightTime != null).length,
    exhibitionRows: rows.filter((r) => r.exhibitionTime != null).length,
    originalFieldCounts: result?.originalFieldCounts || null,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = String(searchParams.get("date") || jstToday());
    const supabase = getSupabase();
    const { data: events, error } = await supabase
      .from("bs_race_events")
      .select("race_date,course_code,course_name,race_no,closing_time")
      .eq("race_date", date)
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: false });
    if (error) throw error;

    const byCourse = new Map();
    for (const row of events || []) {
      if (!byCourse.has(row.course_code)) byCourse.set(row.course_code, row);
    }

    const targets = [...byCourse.values()];
    const results = [];
    for (let i = 0; i < targets.length; i += 3) {
      const chunk = targets.slice(i, i + 3);
      const settled = await Promise.all(chunk.map(async (race) => {
        const input = {
          raceDate: race.race_date,
          courseCode: race.course_code,
          raceNo: race.race_no,
        };
        const boatersResult = await fetchBoatersOriginalTenji(input, { timeoutMs: 7000 });
        const support = getOfficialOriginalTenjiSupport(race.course_code);
        let officialResult = null;
        if (!boatersResult.ok && support.supported) {
          officialResult = await fetchOfficialOriginalTenji(input, { timeoutMs: 7000 });
        }
        return {
          courseCode: race.course_code,
          courseName: race.course_name,
          raceNo: race.race_no,
          boaters: summarize(boatersResult),
          officialSupport: support,
          official: officialResult ? summarize(officialResult) : null,
          usableSource: boatersResult.ok ? "boaters" : (officialResult?.ok ? support.sourceKey : null),
        };
      }));
      results.push(...settled);
    }

    const counts = results.reduce((acc, r) => {
      const key = r.usableSource || r.boaters.reason || r.boaters.error || `http_${r.boaters.status || "unknown"}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({ ok: true, date, checkedCourses: results.length, counts, results, ranAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || "diagnostic failed" }, { status: 500 });
  }
}
