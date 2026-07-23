import "server-only";

import { createClient } from "@supabase/supabase-js";

const COURSE_NAMES = {
  1: "桐生",
  2: "戸田",
  3: "江戸川",
  4: "平和島",
  5: "多摩川",
  6: "浜名湖",
  7: "蒲郡",
  8: "常滑",
  9: "津",
  10: "三国",
  11: "びわこ",
  12: "住之江",
  13: "尼崎",
  14: "鳴門",
  15: "丸亀",
  16: "児島",
  17: "宮島",
  18: "徳山",
  19: "下関",
  20: "若松",
  21: "芦屋",
  22: "福岡",
  23: "唐津",
  24: "大村",
};

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} が設定されていません。`);
  }
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

export function normalizeDate(value) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export function normalizeCourseCode(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 24
    ? number
    : null;
}

export function normalizeRaceNo(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 12
    ? number
    : null;
}

export function getCourseName(courseCode) {
  return COURSE_NAMES[Number(courseCode)] ?? `場コード${courseCode}`;
}

export function formatJstDateTime(value) {
  if (!value) return "未同期";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export async function getAvailableDates(limit = 14) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("bs_race_events")
    .select("race_date")
    .order("race_date", { ascending: false })
    .limit(Math.max(1, Number(limit) * 24 * 12));

  if (error) {
    throw new Error(`開催日の取得に失敗しました: ${error.message}`);
  }

  return [
    ...new Set(
      (data ?? [])
        .map((row) => row.race_date)
        .filter(Boolean)
    ),
  ].slice(0, limit);
}

export async function getCoursesByDate(raceDate) {
  const normalizedDate = normalizeDate(raceDate);
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("bs_race_events")
    .select(
      [
        "race_date",
        "course_code",
        "course_name",
        "race_no",
        "closing_time",
        "race_kind_code",
        "program_available",
        "result_available",
        "api_synced_at",
      ].join(",")
    )
    .eq("race_date", normalizedDate)
    .order("course_code", { ascending: true })
    .order("race_no", { ascending: true });

  if (error) {
    throw new Error(`開催一覧の取得に失敗しました: ${error.message}`);
  }

  const courses = new Map();

  for (const row of data ?? []) {
    const courseCode = Number(row.course_code);
    const current = courses.get(courseCode) ?? {
      courseCode,
      courseName: row.course_name || getCourseName(courseCode),
      raceDate: normalizedDate,
      apiSyncedAt: row.api_synced_at ?? null,
      races: [],
    };

    current.races.push({
      raceNo: Number(row.race_no),
      closingTime: row.closing_time,
      raceKindCode: row.race_kind_code,
      programAvailable: Boolean(row.program_available),
      resultAvailable: Boolean(row.result_available),
    });

    if (
      row.api_synced_at &&
      (!current.apiSyncedAt ||
        new Date(row.api_synced_at) > new Date(current.apiSyncedAt))
    ) {
      current.apiSyncedAt = row.api_synced_at;
    }

    courses.set(courseCode, current);
  }

  return [...courses.values()];
}

export async function getRaceDetail(raceDate, courseCode, raceNo) {
  const normalizedDate = normalizeDate(raceDate);
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const normalizedRaceNo = normalizeRaceNo(raceNo);

  if (!normalizedCourseCode || !normalizedRaceNo) {
    return null;
  }

  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("v_bs_race_page")
    .select("*")
    .eq("race_date", normalizedDate)
    .eq("course_code", normalizedCourseCode)
    .eq("race_no", normalizedRaceNo)
    .order("boat_no", { ascending: true });

  if (error) {
    throw new Error(`レース詳細の取得に失敗しました: ${error.message}`);
  }

  if (!data?.length) return null;

  const first = data[0];

  return {
    event: {
      race_date: first.race_date,
      opening_date: first.opening_date,
      course_code: Number(first.course_code),
      course_name:
        first.course_name || getCourseName(first.course_code),
      race_no: Number(first.race_no),
      race_day_no: first.race_day_no,
      race_kind_code: first.race_kind_code,
      is_fixed_entry: first.is_fixed_entry,
      distance: first.distance,
      closing_time: first.closing_time,
      weather_code: first.weather_code,
      wind_direction_code: first.wind_direction_code,
      wind_speed: first.wind_speed,
      wave_height: first.wave_height,
      winning_technique_code: first.winning_technique_code,
      trifecta: first.trifecta,
      trifecta_payout: first.trifecta_payout,
      trifecta_popularity: first.trifecta_popularity,
      race_cancel_code: first.race_cancel_code,
      program_available: first.program_available,
      result_available: first.result_available,
      api_synced_at: first.api_synced_at,
    },

    entries: data.map((row) => ({
      ...row,
      boat_no: Number(row.boat_no),

      // 公式展示
      exhibition_time: row.exhibition_time,
      exhibition_course: row.exhibition_course,
      exhibition_st: row.exhibition_st,

      // 本番データ
      actual_course: row.actual_course,
      actual_start_timing: row.actual_start_timing,
      actual_start_order: row.actual_start_order,
      arrival_order: row.arrival_order,
    })),
  };
}
