import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数が未設定です");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function calcStats(rows) {
  const alerts = rows || [];
  const finished = alerts.filter((row) => row.result_synced_at);
  const first = finished.filter((row) => Number(row.result_rank) === 1).length;
  const top2 = finished.filter((row) => [1, 2].includes(Number(row.result_rank))).length;
  const top3 = finished.filter((row) => [1, 2, 3].includes(Number(row.result_rank))).length;
  const payoutTotal = finished.reduce((sum, row) => sum + Number(row.trifecta_payout || 0), 0);
  return {
    matched: alerts.length,
    finished: finished.length,
    first,
    top2,
    top3,
    firstRate: finished.length ? first / finished.length : null,
    top2Rate: finished.length ? top2 / finished.length : null,
    top3Rate: finished.length ? top3 / finished.length : null,
    payoutTotal,
  };
}

function buildDaily(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = row.race_date;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return Array.from(map.entries())
    .map(([date, items]) => ({ date, ...calcStats(items) }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export async function GET(request) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || jstToday();
    const mode = searchParams.get("mode") || "day";

    const fields = "id,race_date,course_code,course_name,race_no,boat_no,closing_time,exhibition_time,exhibition_rank,straight_time,straight_rank,detected_at,notified,notified_at,result_rank,trifecta,trifecta_payout,result_synced_at";

    let dayRows = [];
    if (mode !== "all") {
      const { data, error } = await supabase
        .from("bs_exhibition_alerts")
        .select(fields)
        .eq("race_date", date)
        .order("closing_time", { ascending: false });
      if (error) throw error;
      dayRows = data || [];
    }

    const { data: allRows, error: allError } = await supabase
      .from("bs_exhibition_alerts")
      .select(fields)
      .order("race_date", { ascending: false })
      .order("closing_time", { ascending: false })
      .limit(5000);
    if (allError) throw allError;

    const history = allRows || [];

    return NextResponse.json({
      ok: true,
      date,
      mode,
      alerts: mode === "all" ? history : dayRows,
      stats: calcStats(mode === "all" ? history : dayRows),
      allStats: calcStats(history),
      daily: buildDaily(history),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || "取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("evaluate_boat4_double_top_alerts");
    if (error) throw error;
    return NextResponse.json({ ok: true, inserted: Number(data || 0) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || "判定に失敗しました" },
      { status: 500 }
    );
  }
}
