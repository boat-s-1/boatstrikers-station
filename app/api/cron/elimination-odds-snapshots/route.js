import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOfficialTrifectaOdds } from "../../../../lib/boatraceOdds";
import { saveEliminationOddsSnapshot } from "../../../../lib/eliminationOddsSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} が設定されていません。`);
  return value;
}

function getSupabaseServerClient() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}

function getJstParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    minutes: Number(value.hour) * 60 + Number(value.minute),
  };
}

function closingMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = items[index++];
      results.push(await worker(current));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const { date, minutes } = getJstParts();
    const supabase = getSupabaseServerClient();
    const { data: races, error } = await supabase
      .from("bs_race_events")
      .select("race_date,course_code,race_no,closing_time,result_available")
      .eq("race_date", date)
      .eq("result_available", false);

    if (error) throw error;

    const targets = (races || []).filter((race) => {
      const close = closingMinutes(race.closing_time);
      if (close === null) return false;
      const untilClose = close - minutes;
      return untilClose >= 3 && untilClose <= 23;
    });

    const results = await mapLimit(targets, 4, async (race) => {
      try {
        const oddsData = await getOfficialTrifectaOdds({
          raceDate: date,
          courseCode: Number(race.course_code),
          raceNo: Number(race.race_no),
        });
        const saved = await saveEliminationOddsSnapshot({
          raceDate: date,
          courseCode: Number(race.course_code),
          raceNo: Number(race.race_no),
          odds: oddsData?.odds || {},
          oddsCount: oddsData?.count || 0,
          source: oddsData?.source || "boatrace_official",
          resultAvailable: false,
        });
        return { courseCode: race.course_code, raceNo: race.race_no, oddsCount: oddsData?.count || 0, ...saved };
      } catch (error) {
        return { courseCode: race.course_code, raceNo: race.race_no, saved: false, reason: error?.message || String(error) };
      }
    });

    return NextResponse.json({
      ok: true,
      date,
      targetCount: targets.length,
      savedCount: results.filter((row) => row.saved).length,
      results,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}
