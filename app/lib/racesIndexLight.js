import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getCourseName, normalizeDate } from "./boatstrikersPlatform";

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

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function latestIso(values) {
  const timestamps = values
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function createClosingAt(raceDate, closingTime) {
  const text = String(closingTime ?? "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, hh, mm, ss = "00"] = match;
  const date = new Date(
    `${raceDate}T${String(hh).padStart(2, "0")}:${mm}:${ss}+09:00`
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getJstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getLiveStatus({ raceCount, resultCount, exhibitionCount }) {
  if (raceCount > 0 && resultCount >= raceCount) return "finished";
  if (resultCount > 0) return "live";
  if (exhibitionCount > 0) return "exhibition";
  return "scheduled";
}

function mapLightEntry(row) {
  return {
    boat_no: toNumber(row.boat_no),
    national_win_rate: toNumber(row.national_win_rate),
    local_win_rate: toNumber(row.local_win_rate),
    motor_2_rate: toNumber(row.motor_top2_rate ?? row.motor_2_rate),
    boat_2_rate: toNumber(row.race_boat_top2_rate ?? row.boat_2_rate),
    average_st: toNumber(row.average_st),
    exhibition_time: toNumber(row.exhibition_time),
    exhibition_st: toNumber(row.official_exhibition_st ?? row.exhibition_st),
    exhibition_synced_at:
      row.exhibition_synced_at ?? row.api_synced_at ?? row.synced_at ?? row.updated_at ?? null,
  };
}

export async function getCoursesForRacesIndex(raceDate) {
  const normalizedDate = normalizeDate(raceDate);
  const supabase = getSupabaseServerClient();

  const [
    { data: eventRows, error: eventError },
    { data: entryRows, error: entryError },
    { data: resultRows, error: resultError },
  ] = await Promise.all([
    supabase
      .from("bs_race_events")
      .select(
        "race_date,course_code,course_name,race_no,race_day_no,race_kind_code,opening_date,closing_time,program_available,result_available,api_synced_at,synced_at,updated_at"
      )
      .eq("race_date", normalizedDate)
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: true }),

    supabase
      .from("bs_race_entries")
      .select(
        "course_code,race_no,boat_no,national_win_rate,local_win_rate,motor_top2_rate,motor_2_rate,race_boat_top2_rate,boat_2_rate,average_st,exhibition_time,official_exhibition_st,exhibition_st,exhibition_synced_at,api_synced_at,synced_at,updated_at"
      )
      .eq("race_date", normalizedDate)
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: true })
      .order("boat_no", { ascending: true }),

    supabase
      .from("bs_race_results")
      .select("course_code,race_no")
      .eq("race_date", normalizedDate),
  ]);

  if (eventError) throw new Error(`開催一覧の取得に失敗しました: ${eventError.message}`);
  if (entryError) throw new Error(`出走艇一覧の取得に失敗しました: ${entryError.message}`);
  if (resultError) throw new Error(`レース結果一覧の取得に失敗しました: ${resultError.message}`);

  const entriesByRace = new Map();
  for (const row of entryRows ?? []) {
    const key = `${Number(row.course_code)}:${Number(row.race_no)}`;
    const list = entriesByRace.get(key) ?? [];
    list.push(mapLightEntry(row));
    entriesByRace.set(key, list);
  }

  const resultKeys = new Set(
    (resultRows ?? []).map((row) => `${Number(row.course_code)}:${Number(row.race_no)}`)
  );

  const courseMap = new Map();

  for (const row of eventRows ?? []) {
    const courseCode = Number(row.course_code);
    const raceNo = Number(row.race_no);
    const key = `${courseCode}:${raceNo}`;
    const entries = entriesByRace.get(key) ?? [];
    const closingAt = createClosingAt(normalizedDate, row.closing_time);
    const resultAvailable = Boolean(row.result_available) || resultKeys.has(key);
    const hasExhibition = entries.some(
      (entry) => entry.exhibition_time != null || entry.exhibition_st != null
    );
    const syncedAt = latestIso([
      row.api_synced_at,
      row.synced_at,
      row.updated_at,
      ...entries.map((entry) => entry.exhibition_synced_at),
    ]);

    const course = courseMap.get(courseCode) ?? {
      courseCode,
      courseName: row.course_name || getCourseName(courseCode),
      raceDate: normalizedDate,
      raceCount: 0,
      exhibitionCount: 0,
      startedExhibitionCount: 0,
      resultCount: 0,
      nextRaceNo: null,
      nextClosingTime: null,
      nextClosingAt: null,
      liveRaceNo: null,
      syncedAt: null,
      apiSyncedAt: null,
      exhibitionSyncedAt: null,
      hasAiPrediction: false,
      aiPublished: false,
      aiPredictionCount: 0,
      previousPredictionCount: 0,
      livePredictionCount: 0,
      races: [],
    };

    course.raceCount += 1;
    if (hasExhibition && !resultAvailable) {
      course.exhibitionCount += 1;
      course.startedExhibitionCount += 1;
    }
    if (resultAvailable) course.resultCount += 1;

    const event = {
      race_date: normalizedDate,
      opening_date: row.opening_date,
      course_code: courseCode,
      course_name: row.course_name || getCourseName(courseCode),
      race_no: raceNo,
      race_day_no: toNumber(row.race_day_no),
      race_kind_code: row.race_kind_code,
      closing_time: row.closing_time,
      program_available: Boolean(row.program_available),
      result_available: resultAvailable,
      synced_at: syncedAt,
      api_synced_at: syncedAt,
      updated_at: row.updated_at,
    };

    course.races.push({
      raceNo,
      race_no: raceNo,
      raceStatus: resultAvailable ? "result" : hasExhibition ? "exhibition" : "scheduled",
      race_status: resultAvailable ? "result" : hasExhibition ? "exhibition" : "scheduled",
      closingTime: row.closing_time,
      closing_time: row.closing_time,
      closingAt,
      closing_at: closingAt,
      raceKindCode: row.race_kind_code,
      race_kind_code: row.race_kind_code,
      programAvailable: Boolean(row.program_available),
      program_available: Boolean(row.program_available),
      resultAvailable,
      result_available: resultAvailable,
      hasExhibition,
      has_exhibition: hasExhibition,
      syncedAt,
      synced_at: syncedAt,
      apiSyncedAt: syncedAt,
      api_synced_at: syncedAt,
      event,
      entries,
      result: null,
      resultEntries: [],
    });

    course.syncedAt = latestIso([course.syncedAt, syncedAt]);
    course.apiSyncedAt = course.syncedAt;
    course.exhibitionSyncedAt = latestIso([
      course.exhibitionSyncedAt,
      ...entries.map((entry) => entry.exhibition_synced_at),
    ]);
    courseMap.set(courseCode, course);
  }

  const today = getJstDateString();
  const now = Date.now();

  return [...courseMap.values()]
    .map((course) => {
      const races = [...course.races].sort((a, b) => a.raceNo - b.raceNo);
      const nextRace = normalizedDate >= today
        ? races.find((race) => {
            if (race.resultAvailable) return false;
            if (!race.closingAt) return true;
            const time = new Date(race.closingAt).getTime();
            return !Number.isFinite(time) || time > now;
          }) ?? null
        : null;
      const liveRace = races.find((race) => race.hasExhibition && !race.resultAvailable) ?? null;
      const liveStatus = getLiveStatus({
        raceCount: course.raceCount,
        resultCount: course.resultCount,
        exhibitionCount: course.exhibitionCount,
      });

      return {
        ...course,
        races,
        liveStatus,
        live_status: liveStatus,
        nextRaceNo: nextRace?.raceNo ?? null,
        next_race_no: nextRace?.raceNo ?? null,
        nextClosingTime: nextRace?.closingTime ?? null,
        next_closing_time: nextRace?.closingTime ?? null,
        nextClosingAt: nextRace?.closingAt ?? null,
        next_closing_at: nextRace?.closingAt ?? null,
        liveRaceNo: liveRace?.raceNo ?? null,
        live_race_no: liveRace?.raceNo ?? null,
        synced_at: course.syncedAt,
        api_synced_at: course.apiSyncedAt,
        exhibition_synced_at: course.exhibitionSyncedAt,
      };
    })
    .sort((a, b) => a.courseCode - b.courseCode);
}
