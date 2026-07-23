import "server-only";

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

function getSupabaseServerClient() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function toNumberOrNull(value) {
  if (!hasValue(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIntegerOrNull(value) {
  const n = toNumberOrNull(value);
  return n === null ? null : Math.trunc(n);
}

function firstValue(...values) {
  return values.find(hasValue) ?? null;
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
  return Number.isInteger(number) && number >= 1 && number <= 24 ? number : null;
}

export function normalizeRaceNo(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 12 ? number : null;
}

export function normalizeRacerName(value) {
  return String(value ?? "").replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
}

export function getCourseName(courseCode) {
  return COURSE_NAMES[Number(courseCode)] ?? `場コード${courseCode}`;
}

export function formatNumber(value, digits = 2, fallback = "-") {
  const number = toNumberOrNull(value);
  return number === null ? fallback : number.toFixed(digits);
}

export function formatJstDateTime(value) {
  if (!value) return "未同期";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function mapEntry(row) {
  const boatNo = toIntegerOrNull(firstValue(row.boat_no, row.teiban));
  const motorNo = toIntegerOrNull(firstValue(row.motor_number, row.motor_no));
  const boatMachineNo = toIntegerOrNull(firstValue(row.race_boat_number, row.boat_machine_no));
  const racerClass = firstValue(row.class, row.racer_class, row.kyubetsu);
  const syncedAt = firstValue(row.api_synced_at, row.synced_at, row.updated_at);

  return {
    ...row,
    boat_no: boatNo,
    racer_registration_no: String(firstValue(row.racer_registration_no, row.toroku_bango) ?? ""),
    racer_name: normalizeRacerName(firstValue(row.racer_name, row.shimei)),
    racer_class: racerClass,
    class: racerClass,
    national_win_rate: toNumberOrNull(row.national_win_rate),
    national_2_rate: toNumberOrNull(firstValue(row.national_top2_rate, row.national_2_rate)),
    local_win_rate: toNumberOrNull(row.local_win_rate),
    local_2_rate: toNumberOrNull(firstValue(row.local_top2_rate, row.local_2_rate)),
    motor_no: motorNo,
    motor_number: motorNo,
    motor_2_rate: toNumberOrNull(firstValue(row.motor_top2_rate, row.motor_2_rate)),
    boat_machine_no: boatMachineNo,
    race_boat_number: boatMachineNo,
    boat_2_rate: toNumberOrNull(firstValue(row.race_boat_top2_rate, row.boat_2_rate)),
    average_st: toNumberOrNull(row.average_st),
    exhibition_time: toNumberOrNull(row.exhibition_time),
    exhibition_course: toIntegerOrNull(row.exhibition_course),
    exhibition_st: toNumberOrNull(row.exhibition_st),
    exhibition_fl: firstValue(row.exhibition_fl, row.show_fl),

    // 公式オリ展（C4）
    half_lap_time: toNumberOrNull(row.half_lap_time),
    lap_time: toNumberOrNull(row.lap_time),
    turn_time: toNumberOrNull(row.turn_time),
    straight_time: toNumberOrNull(row.straight_time),

    // 展示データの更新元を判別するための情報
    exhibition_source: firstValue(row.exhibition_source, row.data_source),
    exhibition_synced_at: firstValue(
      row.exhibition_synced_at,
      row.synced_at,
      row.api_synced_at
    ),
    tilt: toNumberOrNull(row.tilt),
    parts_changed: firstValue(row.parts_changed, row.parts_change),
    arrival_order: toIntegerOrNull(row.arrival_order),
    actual_course: toIntegerOrNull(row.actual_course),
    actual_start_timing: toNumberOrNull(row.actual_start_timing),
    actual_start_order: toIntegerOrNull(row.actual_start_order),
    race_time: toNumberOrNull(row.race_time),
    current_series_results: firstValue(row.current_series_results, row.series_results, ""),
    synced_at: syncedAt,
    api_synced_at: syncedAt,
  };
}

function mapEvent(row) {
  const syncedAt = firstValue(row.api_synced_at, row.synced_at, row.updated_at);
  return {
    race_date: row.race_date,
    opening_date: row.opening_date,
    course_code: Number(row.course_code),
    course_name: row.course_name || getCourseName(row.course_code),
    race_no: Number(row.race_no),
    race_day_no: toIntegerOrNull(row.race_day_no),
    race_kind_code: row.race_kind_code,
    is_fixed_entry: row.is_fixed_entry,
    distance: toIntegerOrNull(row.distance),
    closing_time: row.closing_time,
    weather_code: row.weather_code,
    wind_direction_code: row.wind_direction_code,
    wind_speed: toNumberOrNull(row.wind_speed),
    wave_height: toNumberOrNull(row.wave_height),
    winning_technique_code: row.winning_technique_code,
    trifecta: row.trifecta,
    trifecta_payout: toIntegerOrNull(row.trifecta_payout),
    trifecta_popularity: toIntegerOrNull(row.trifecta_popularity),
    race_cancel_code: row.race_cancel_code,
    program_available: Boolean(row.program_available),
    result_available: Boolean(row.result_available),
    synced_at: syncedAt,
    api_synced_at: syncedAt,
  };
}

export async function getAvailableDates(limit = 14) {
  const supabase = getSupabaseServerClient();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 14, 90));
  const { data, error } = await supabase
    .from("bs_race_events").select("race_date")
    .order("race_date", { ascending: false }).limit(safeLimit * 24 * 12);
  if (error) throw new Error(`開催日の取得に失敗しました: ${error.message}`);
  return [...new Set((data ?? []).map((row) => row.race_date).filter(Boolean))].slice(0, safeLimit);
}

export async function getCoursesByDate(raceDate) {
  const normalizedDate = normalizeDate(raceDate);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("bs_race_events")
    .select("race_date,course_code,course_name,race_no,closing_time,race_kind_code,program_available,result_available,api_synced_at")
    .eq("race_date", normalizedDate)
    .order("course_code", { ascending: true }).order("race_no", { ascending: true });
  if (error) throw new Error(`開催一覧の取得に失敗しました: ${error.message}`);

  const courses = new Map();
  for (const row of data ?? []) {
    const courseCode = Number(row.course_code);
    const current = courses.get(courseCode) ?? {
      courseCode, courseName: row.course_name || getCourseName(courseCode),
      raceDate: normalizedDate, apiSyncedAt: row.api_synced_at ?? null, races: [],
    };
    current.races.push({
      raceNo: Number(row.race_no), race_no: Number(row.race_no),
      closingTime: row.closing_time, closing_time: row.closing_time,
      raceKindCode: row.race_kind_code, race_kind_code: row.race_kind_code,
      programAvailable: Boolean(row.program_available), resultAvailable: Boolean(row.result_available),
    });
    courses.set(courseCode, current);
  }
  return [...courses.values()];
}

export async function getCourseRaces(raceDate, courseCode) {
  const normalizedDate = normalizeDate(raceDate);
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  if (!normalizedCourseCode) return [];

  const supabase = getSupabaseServerClient();

  const [{ data: eventRows, error: eventError }, { data: entryRows, error: entryError }] =
    await Promise.all([
      supabase
        .from("bs_race_events")
        .select("*")
        .eq("race_date", normalizedDate)
        .eq("course_code", normalizedCourseCode)
        .order("race_no", { ascending: true }),
      supabase
        .from("bs_race_entries")
        .select("*")
        .eq("race_date", normalizedDate)
        .eq("course_code", normalizedCourseCode)
        .order("race_no", { ascending: true })
        .order("boat_no", { ascending: true }),
    ]);

  if (eventError) {
    throw new Error(`レース一覧の取得に失敗しました: ${eventError.message}`);
  }
  if (entryError) {
    throw new Error(`出走艇一覧の取得に失敗しました: ${entryError.message}`);
  }

  const entriesByRace = new Map();

  for (const row of entryRows ?? []) {
    const raceNo = Number(row.race_no);
    const current = entriesByRace.get(raceNo) ?? [];
    current.push(mapEntry(row));
    entriesByRace.set(raceNo, current);
  }

  return (eventRows ?? []).map((row) => {
    const event = mapEvent(row);
    const entries = entriesByRace.get(Number(row.race_no)) ?? [];
    const hasExhibition = entries.some(
      (entry) =>
        hasValue(entry.exhibition_time) ||
        hasValue(entry.exhibition_st) ||
        hasValue(entry.lap_time) ||
        hasValue(entry.turn_time) ||
        hasValue(entry.straight_time)
    );

    return {
      ...event,
      race_status: event.result_available
        ? "result"
        : hasExhibition
          ? "exhibition"
          : "program",
      entries,
    };
  });
}

export async function getRaceDetail(raceDate, courseCode, raceNo) {
  const normalizedDate = normalizeDate(raceDate);
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const normalizedRaceNo = normalizeRaceNo(raceNo);

  if (!normalizedCourseCode || !normalizedRaceNo) return null;

  const supabase = getSupabaseServerClient();

  const [{ data: eventRow, error: eventError }, { data: entryRows, error: entryError }] =
    await Promise.all([
      supabase
        .from("bs_race_events")
        .select("*")
        .eq("race_date", normalizedDate)
        .eq("course_code", normalizedCourseCode)
        .eq("race_no", normalizedRaceNo)
        .maybeSingle(),
      supabase
        .from("bs_race_entries")
        .select("*")
        .eq("race_date", normalizedDate)
        .eq("course_code", normalizedCourseCode)
        .eq("race_no", normalizedRaceNo)
        .order("boat_no", { ascending: true }),
    ]);

  if (eventError) {
    throw new Error(`レース情報の取得に失敗しました: ${eventError.message}`);
  }
  if (entryError) {
    throw new Error(`レース詳細の取得に失敗しました: ${entryError.message}`);
  }
  if (!eventRow || !entryRows?.length) return null;

  const event = mapEvent(eventRow);
  const entries = entryRows.map(mapEntry);
  const resultEntries = entries.filter((entry) => entry.arrival_order !== null);

  const result =
    event.result_available || resultEntries.length
      ? {
          trifecta: event.trifecta,
          trifecta_payout: event.trifecta_payout,
          trifecta_popularity: event.trifecta_popularity,
          winning_technique_code: event.winning_technique_code,
        }
      : null;

  return {
    event,
    entries,
    previousPrediction: null,
    livePrediction: null,
    result,
    resultEntries,
  };
}
