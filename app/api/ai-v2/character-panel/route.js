import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHARACTER_TYPES = {
  ichika: ["ichika_escape_best10"],
  hatsune: ["hatsune_dominant_best3", "hatsune_risky_best3"],
  kiina: ["kiina_boat5_best5"],
};

const DEFAULT_LIMIT = 3;

function jstDateOffset(offsetDays = 0) {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCDate(jst.getUTCDate() + offsetDays);
  return jst.toISOString().slice(0, 10);
}

function jstToday() {
  return jstDateOffset(0);
}

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeStat(row) {
  return {
    rankingType: row.ranking_type,
    predictions: Number(row.predictions || 0),
    hits: Number(row.hits || 0),
    hitRate: row.hit_rate == null ? null : Number(row.hit_rate),
  };
}

function statsMap(rows) {
  return new Map((rows || []).map((row) => [row.ranking_type, normalizeStat(row)]));
}

function buildYesterdayStats(types, throughYesterdayRows, throughDayBeforeRows) {
  const yesterdayMap = statsMap(throughYesterdayRows);
  const dayBeforeMap = statsMap(throughDayBeforeRows);

  return types.map((rankingType) => {
    const yesterday = yesterdayMap.get(rankingType) || { predictions: 0, hits: 0 };
    const dayBefore = dayBeforeMap.get(rankingType) || { predictions: 0, hits: 0 };
    const predictions = Math.max(0, Number(yesterday.predictions || 0) - Number(dayBefore.predictions || 0));
    const hits = Math.max(0, Number(yesterday.hits || 0) - Number(dayBefore.hits || 0));

    return {
      rankingType,
      predictions,
      hits,
      hitRate: predictions > 0 ? (hits / predictions) * 100 : null,
    };
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const character = String(searchParams.get("character") || "").toLowerCase();
  const types = CHARACTER_TYPES[character];

  if (!types) {
    return NextResponse.json({ error: "invalid_character" }, { status: 400 });
  }

  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const today = jstToday();
  const yesterday = jstDateOffset(-1);
  const dayBeforeYesterday = jstDateOffset(-2);

  const [rankingResult, statResult, statYesterdayResult, statDayBeforeResult, startResult] = await Promise.all([
    client
      .from("ai_v2_daily_rankings")
      .select("ranking_type,rank_no,course_code,race_no,probability,selected_for_home")
      .eq("ranking_date", today)
      .eq("data_timing", "previous_day")
      .in("ranking_type", types)
      .order("ranking_type", { ascending: true })
      .order("rank_no", { ascending: true }),
    client.rpc("ai_v2_public_character_stats", { p_as_of: today }),
    client.rpc("ai_v2_public_character_stats", { p_as_of: yesterday }),
    client.rpc("ai_v2_public_character_stats", { p_as_of: dayBeforeYesterday }),
    client
      .from("ai_v2_daily_rankings")
      .select("ranking_date")
      .eq("data_timing", "previous_day")
      .in("ranking_type", types)
      .order("ranking_date", { ascending: true })
      .limit(1),
  ]);

  if (rankingResult.error) {
    return NextResponse.json({ error: rankingResult.error.message }, { status: 500 });
  }

  const allRows = rankingResult.data || [];
  const anySelected = allRows.some((row) => row.selected_for_home === true);

  const picks = [];
  for (const type of types) {
    const group = allRows.filter((row) => row.ranking_type === type);
    const visible = anySelected
      ? group.filter((row) => row.selected_for_home === true)
      : group.slice(0, DEFAULT_LIMIT);

    for (const row of visible) {
      picks.push({
        rankingType: row.ranking_type,
        rankNo: Number(row.rank_no),
        courseCode: Number(row.course_code),
        raceNo: Number(row.race_no),
        probability: row.probability == null ? null : Number(row.probability),
      });
    }
  }

  const stats = statResult.error
    ? []
    : (statResult.data || []).map(normalizeStat).filter((row) => types.includes(row.rankingType));

  const yesterdayStats = statYesterdayResult.error || statDayBeforeResult.error
    ? []
    : buildYesterdayStats(types, statYesterdayResult.data || [], statDayBeforeResult.data || []);

  return NextResponse.json({
    character,
    date: today,
    yesterdayDate: yesterday,
    startDate: startResult.data?.[0]?.ranking_date || null,
    selectionMode: anySelected ? "manual" : "auto",
    picks,
    stats,
    yesterdayStats,
  });
}
