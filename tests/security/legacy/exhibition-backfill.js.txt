import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchBoatersOriginalTenji } from "../../../../lib/boatersOriginalTenji";
import { fetchOfficialOriginalTenji } from "../../../../lib/officialOriginalTenji";

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

function has(v) { return v !== null && v !== undefined && v !== ""; }

async function saveRows(supabase, race, source) {
  const syncedAt = new Date().toISOString();
  let saved = 0;
  for (const row of source.rows || []) {
    const update = {
      official_exhibition_source: source.source || "boaters_backfill",
      official_exhibition_synced_at: syncedAt,
    };
    if (has(row.exhibitionTime)) update.official_exhibition_time = row.exhibitionTime;
    if (has(row.lapTime)) update.official_lap = row.lapTime;
    if (has(row.turnTime)) update.official_turn = row.turnTime;
    if (has(row.straightTime)) update.official_straight = row.straightTime;
    if (has(row.exhibitionSt)) update.official_exhibition_st = row.exhibitionSt;
    if (row.exhibitionSymbol !== undefined) update.official_exhibition_symbol = row.exhibitionSymbol || null;
    const { error } = await supabase.from("bs_race_entries").update(update)
      .eq("race_date", race.race_date)
      .eq("course_code", race.course_code)
      .eq("race_no", race.race_no)
      .eq("boat_no", row.boatNo);
    if (error) throw error;
    saved += 1;
  }
  return saved;
}

async function fetchSource(race) {
  const input = { raceDate: race.race_date, courseCode: race.course_code, raceNo: race.race_no };
  const boaters = await fetchBoatersOriginalTenji(input, { timeoutMs: 6000 });
  if (boaters.ok) return { ...boaters, source: "boaters_backfill" };
  const official = await fetchOfficialOriginalTenji(input, { timeoutMs: 6000 });
  if (official.ok) return official;
  return {
    ok: false,
    source: null,
    rows: [],
    error: boaters.error || official.error || "detail_not_available",
    boatersError: boaters.error || null,
    officialError: official.error || null,
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const date = String(body.date || jstToday());
    const cursor = Math.max(0, Number(body.cursor || 0));
    const batchSize = Math.min(24, Math.max(1, Number(body.batchSize || 18)));
    const supabase = getSupabase();

    const { data: events, error: eventError } = await supabase.from("bs_race_events")
      .select("race_date,course_code,course_name,race_no,closing_time")
      .eq("race_date", date)
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: true });
    if (eventError) throw eventError;

    const all = events || [];
    const batch = all.slice(cursor, cursor + batchSize);
    const results = [];

    // 外部サイトへの負荷を抑えつつ、Vercel側では十分速く終わるよう3件ずつ処理する。
    for (let i = 0; i < batch.length; i += 3) {
      const chunk = batch.slice(i, i + 3);
      const settled = await Promise.all(chunk.map(async (race) => {
        const { data: existing, error: existingError } = await supabase.from("bs_race_entries")
          .select("boat_no,official_lap,official_straight,official_exhibition_time")
          .eq("race_date", race.race_date)
          .eq("course_code", race.course_code)
          .eq("race_no", race.race_no);
        if (existingError) throw existingError;
        const rows = existing || [];
        const alreadyDetailed = rows.length === 6 && rows.every((r) => has(r.official_lap) || has(r.official_straight));
        if (alreadyDetailed) return { courseCode: race.course_code, raceNo: race.race_no, skipped: true, reason: "already_detailed" };

        const source = await fetchSource(race);
        if (!source.ok) return { courseCode: race.course_code, raceNo: race.race_no, saved: 0, source: null, error: source.error };
        const saved = await saveRows(supabase, race, source);
        return { courseCode: race.course_code, raceNo: race.race_no, saved, source: source.source || "unknown" };
      }));
      results.push(...settled);
    }

    const nextCursor = cursor + batch.length < all.length ? cursor + batch.length : null;
    const savedRaces = results.filter((r) => Number(r.saved || 0) > 0).length;
    const savedRows = results.reduce((sum, r) => sum + Number(r.saved || 0), 0);
    const skipped = results.filter((r) => r.skipped).length;
    const unavailable = results.filter((r) => !r.skipped && !r.saved).length;

    return NextResponse.json({
      ok: true,
      date,
      totalRaces: all.length,
      cursor,
      processed: batch.length,
      nextCursor,
      savedRaces,
      savedRows,
      skipped,
      unavailable,
      results,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || "backfill failed" }, { status: 500 });
  }
}
