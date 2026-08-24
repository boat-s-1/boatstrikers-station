import "server-only";

import { unstable_cache } from "next/cache";
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

function getClient() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function closingAt(raceDate, value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const iso = `${raceDate}T${String(match[1]).padStart(2, "0")}:${match[2]}:${match[3] ?? "00"}+09:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function latestIso(values) {
  const times = values
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

function rawRaceStatus(event, entries) {
  if (event.result_available) return "result";
  const hasExhibition = entries.some((entry) =>
    entry.exhibition_time != null ||
    entry.exhibition_st != null ||
    entry.official_exhibition_time != null ||
    entry.official_exhibition_st != null
  );
  return hasExhibition ? "exhibition" : "program";
}

async function loadLightCourses(raceDate) {
  const supabase = getClient();

  const [eventsRes, entriesRes] = await Promise.all([
    supabase
      .from("bs_race_events")
      .select("race_date,course_code,course_name,race_no,race_day_no,race_kind_code,closing_time,result_available,program_available,opening_date,api_synced_at,synced_at,updated_at")
      .eq("race_date", raceDate)
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: true }),
    supabase
      .from("bs_race_entries")
      .select("course_code,race_no,boat_no,gender,gender_code,sex_code,exhibition_time,exhibition_st,official_exhibition_time,official_exhibition_st")
      .eq("race_date", raceDate)
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: true })
      .order("boat_no", { ascending: true }),
  ]);

  if (eventsRes.error) throw new Error(`開催一覧の取得に失敗しました: ${eventsRes.error.message}`);
  if (entriesRes.error) throw new Error(`軽量出走艇一覧の取得に失敗しました: ${entriesRes.error.message}`);

  const entriesByRace = new Map();
  for (const entry of entriesRes.data ?? []) {
    const key = `${Number(entry.course_code)}:${Number(entry.race_no)}`;
    const list = entriesByRace.get(key) ?? [];
    list.push(entry);
    entriesByRace.set(key, list);
  }

  const courseMap = new Map();
  for (const event of eventsRes.data ?? []) {
    const courseCode = Number(event.course_code);
    const raceNo = Number(event.race_no);
    const key = `${courseCode}:${raceNo}`;
    const entries = entriesByRace.get(key) ?? [];
    const raceStatus = rawRaceStatus(event, entries);
    const hasExhibition = raceStatus === "exhibition";
    const resultAvailable = raceStatus === "result";
    const raceClosingAt = closingAt(raceDate, event.closing_time);

    const course = courseMap.get(courseCode) ?? {
      courseCode,
      courseName: event.course_name || COURSE_NAMES[courseCode] || `場コード${courseCode}`,
      raceDate,
      raceCount: 0,
      exhibitionCount: 0,
      startedExhibitionCount: 0,
      resultCount: 0,
      nextRaceNo: null,
      nextClosingTime: null,
      nextClosingAt: null,
      liveRaceNo: null,
      syncedAt: null,
      races: [],
    };

    course.raceCount += 1;
    if (hasExhibition) {
      course.exhibitionCount += 1;
      course.startedExhibitionCount += 1;
    }
    if (resultAvailable) course.resultCount += 1;

    const syncedAt = latestIso([event.api_synced_at, event.synced_at, event.updated_at]);
    course.syncedAt = latestIso([course.syncedAt, syncedAt]);
    course.races.push({
      raceNo,
      race_no: raceNo,
      raceStatus,
      race_status: raceStatus,
      closingTime: event.closing_time,
      closing_time: event.closing_time,
      closingAt: raceClosingAt,
      closing_at: raceClosingAt,
      raceKindCode: event.race_kind_code,
      race_kind_code: event.race_kind_code,
      resultAvailable,
      result_available: resultAvailable,
      hasExhibition,
      has_exhibition: hasExhibition,
      event,
      entries,
    });

    courseMap.set(courseCode, course);
  }

  const now = Date.now();
  const today = jstToday();

  return [...courseMap.values()].map((course) => {
    const races = course.races.sort((a, b) => a.raceNo - b.raceNo);
    const nextRace = raceDate >= today
      ? races.find((race) => {
          if (race.resultAvailable) return false;
          if (!race.closingAt) return true;
          const ts = new Date(race.closingAt).getTime();
          return !Number.isFinite(ts) || ts > now;
        }) ?? null
      : null;
    const liveRace = races.find((race) => race.hasExhibition && !race.resultAvailable) ?? null;
    const liveStatus = course.raceCount > 0 && course.resultCount >= course.raceCount
      ? "finished"
      : course.resultCount > 0
        ? "live"
        : course.startedExhibitionCount > 0
          ? "exhibition"
          : "scheduled";

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
    };
  }).sort((a, b) => a.courseCode - b.courseCode);
}

const cachedLightCourses = unstable_cache(
  async (raceDate) => loadLightCourses(raceDate),
  ["races-top-light-v1"],
  { revalidate: 30, tags: ["races-top-light"] }
);

export async function getCoursesByDateLight(raceDate) {
  return cachedLightCourses(raceDate);
}
