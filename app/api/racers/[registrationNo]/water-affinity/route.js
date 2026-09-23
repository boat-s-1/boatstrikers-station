import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const COURSE_NAMES = {
  1: "桐生", 2: "戸田", 3: "江戸川", 4: "平和島", 5: "多摩川", 6: "浜名湖",
  7: "蒲郡", 8: "常滑", 9: "津", 10: "三国", 11: "びわこ", 12: "住之江",
  13: "尼崎", 14: "鳴門", 15: "丸亀", 16: "児島", 17: "宮島", 18: "徳山",
  19: "下関", 20: "若松", 21: "芦屋", 22: "福岡", 23: "唐津", 24: "大村",
};

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} が設定されていません。`);
  return value;
}

function getSupabase() {
  return createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
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

function finish(row) {
  const arrival = Number(row.arrival_order);
  if (Number.isFinite(arrival) && arrival >= 1 && arrival <= 6) return arrival;
  const match = String(row.finish_place ?? "").match(/[1-6]/);
  return match ? Number(match[0]) : null;
}

function rate(num, den) {
  return den ? (num / den) * 100 : null;
}

function score(item) {
  return (item.winRate ?? 0) * 0.55 + (item.top2Rate ?? 0) * 0.25 + (item.top3Rate ?? 0) * 0.2;
}

function classify(item, overall) {
  if (!item || item.starts < 5) return { label: "データ蓄積中", tone: "neutral" };
  if (item.starts < 10) return { label: "参考データ", tone: "reference" };
  const winDelta = (item.winRate ?? 0) - (overall.winRate ?? 0);
  const top3Delta = (item.top3Rate ?? 0) - (overall.top3Rate ?? 0);
  if (winDelta >= 8 || top3Delta >= 10) return { label: "得意傾向", tone: "good" };
  if (winDelta <= -8 || top3Delta <= -10) return { label: "注意傾向", tone: "caution" };
  return { label: "平均的", tone: "neutral" };
}

export async function GET(_request, { params }) {
  try {
    const { registrationNo: raw } = await params;
    const registrationNo = String(raw ?? "").replace(/\D/g, "").padStart(5, "0");
    if (!registrationNo) return NextResponse.json({ error: "invalid registration number" }, { status: 400 });

    const supabase = getSupabase();
    const today = jstToday();
    const [{ data: rows, error: rowsError }, { data: todayRows, error: todayError }] = await Promise.all([
      supabase
        .from("bs_race_entries")
        .select("course_code,arrival_order,finish_place")
        .eq("racer_registration_no", registrationNo)
        .order("race_date", { ascending: false })
        .limit(1000),
      supabase
        .from("bs_race_entries")
        .select("course_code,race_no,boat_no")
        .eq("racer_registration_no", registrationNo)
        .eq("race_date", today)
        .order("race_no", { ascending: true }),
    ]);

    if (rowsError) throw rowsError;
    if (todayError) throw todayError;

    const completed = (rows ?? []).filter((row) => finish(row));
    const overall = {
      starts: completed.length,
      winRate: rate(completed.filter((r) => finish(r) === 1).length, completed.length),
      top2Rate: rate(completed.filter((r) => finish(r) <= 2).length, completed.length),
      top3Rate: rate(completed.filter((r) => finish(r) <= 3).length, completed.length),
    };

    const byVenue = new Map();
    for (const row of completed) {
      const code = Number(row.course_code);
      if (!code) continue;
      if (!byVenue.has(code)) byVenue.set(code, []);
      byVenue.get(code).push(row);
    }

    const venues = [...byVenue.entries()].map(([courseCode, group]) => {
      const starts = group.length;
      const item = {
        courseCode,
        courseName: COURSE_NAMES[courseCode] || `${courseCode}場`,
        starts,
        wins: group.filter((r) => finish(r) === 1).length,
        winRate: rate(group.filter((r) => finish(r) === 1).length, starts),
        top2Rate: rate(group.filter((r) => finish(r) <= 2).length, starts),
        top3Rate: rate(group.filter((r) => finish(r) <= 3).length, starts),
      };
      item.score = score(item);
      item.sample = starts >= 10 ? "normal" : starts >= 5 ? "reference" : "small";
      item.affinity = classify(item, overall);
      return item;
    });

    const reliable = venues.filter((v) => v.starts >= 10);
    const reference = venues.filter((v) => v.starts >= 5 && v.starts < 10);
    const best = [...reliable].sort((a, b) => b.score - a.score).slice(0, 3);
    while (best.length < 3 && reference.length) best.push(reference.shift());

    const weak = [...reliable]
      .filter((v) => v.score < score(overall))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    const todayCodes = [...new Set((todayRows ?? []).map((r) => Number(r.course_code)).filter(Boolean))];
    const todayAffinity = todayCodes.map((courseCode) => {
      const venue = venues.find((v) => v.courseCode === courseCode) || {
        courseCode,
        courseName: COURSE_NAMES[courseCode] || `${courseCode}場`,
        starts: 0,
        winRate: null,
        top2Rate: null,
        top3Rate: null,
      };
      return { ...venue, affinity: classify(venue, overall) };
    });

    return NextResponse.json({ overall, best, weak, todayAffinity });
  } catch (error) {
    console.error("racer water affinity error", error);
    return NextResponse.json({ error: "水面相性データの取得に失敗しました。" }, { status: 500 });
  }
}
