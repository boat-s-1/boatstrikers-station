import "server-only";

import { createClient } from "@supabase/supabase-js";
import { buildPhase2Predictions } from "./phase2PredictionEngine";

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

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function toNumberOrNull(value) {
  if (!hasValue(value)) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toIntegerOrNull(value) {
  const number = toNumberOrNull(value);
  return number === null ? null : Math.trunc(number);
}

function firstValue(...values) {
  return values.find(hasValue) ?? null;
}

function toTimestamp(value) {
  if (!hasValue(value)) return null;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getLatestIsoDate(values) {
  const timestamps = values
    .map(toTimestamp)
    .filter((value) => value !== null);

  if (!timestamps.length) return null;

  return new Date(Math.max(...timestamps)).toISOString();
}

function getJstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeClosingTime(value) {
  if (!hasValue(value)) return null;

  const text = String(value).trim();

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
    const [hour, minute, second = "00"] = text.split(":");

    return {
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second),
    };
  }

  if (/^\d{3,4}$/.test(text)) {
    const padded = text.padStart(4, "0");

    return {
      hour: Number(padded.slice(0, 2)),
      minute: Number(padded.slice(2, 4)),
      second: 0,
    };
  }

  return null;
}

function createClosingAt(raceDate, closingTime) {
  if (!hasValue(closingTime)) return null;

  const text = String(closingTime).trim();

  if (text.includes("T")) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const time = normalizeClosingTime(text);

  if (!time) return null;

  const { hour, minute, second } = time;

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  const date = new Date(
    `${raceDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0"
    )}:${String(second).padStart(2, "0")}+09:00`
  );

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeDate(value) {
  const text = String(value ?? "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return getJstDateString();
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

export function normalizeRacerName(value) {
  return String(value ?? "")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function mapEntry(row) {
  const boatNo = toIntegerOrNull(firstValue(row.boat_no, row.teiban));
  const motorNo = toIntegerOrNull(firstValue(row.motor_number, row.motor_no));
  const boatMachineNo = toIntegerOrNull(
    firstValue(row.race_boat_number, row.boat_machine_no)
  );
  const racerClass = firstValue(row.class, row.racer_class, row.kyubetsu);
  const syncedAt = firstValue(
    row.api_synced_at,
    row.synced_at,
    row.exhibition_synced_at,
    row.updated_at,
    row.created_at
  );

  return {
    ...row,

    boat_no: boatNo,
    teiban: boatNo,

    racer_registration_no: String(
      firstValue(row.racer_registration_no, row.toroku_bango) ?? ""
    ),
    racer_name: normalizeRacerName(
      firstValue(row.racer_name, row.shimei)
    ),
    racer_class: racerClass,
    class: racerClass,

    national_win_rate: toNumberOrNull(row.national_win_rate),
    national_2_rate: toNumberOrNull(
      firstValue(row.national_top2_rate, row.national_2_rate)
    ),
    local_win_rate: toNumberOrNull(row.local_win_rate),
    local_2_rate: toNumberOrNull(
      firstValue(row.local_top2_rate, row.local_2_rate)
    ),

    motor_no: motorNo,
    motor_number: motorNo,
    motor_2_rate: toNumberOrNull(
      firstValue(row.motor_top2_rate, row.motor_2_rate)
    ),

    boat_machine_no: boatMachineNo,
    race_boat_number: boatMachineNo,
    boat_2_rate: toNumberOrNull(
      firstValue(row.race_boat_top2_rate, row.boat_2_rate)
    ),

    average_st: toNumberOrNull(row.average_st),

    exhibition_time: toNumberOrNull(row.exhibition_time),
    exhibition_course: toIntegerOrNull(row.exhibition_course),
    // v10.1: PC-KYOTEI公式展示列を最優先で採用します。
    // exhibition_fl が NULL の場合でも official_exhibition_symbol の F/L を確実に表示します。
    exhibition_st: toNumberOrNull(
      firstValue(row.official_exhibition_st, row.exhibition_st)
    ),
    exhibition_fl: String(
      firstValue(
        row.official_exhibition_symbol,
        row.exhibition_fl,
        row.show_fl,
        row.start_exhibition_fl,
        row.exhibition_f_mark,
        row.exhibition_mark,
        row.start_mark,
        row.st_mark,
        row.flying_flag,
        row.is_flying,
        row.fl,
        row.mark,
        row.note
      ) ?? ""
    ).trim().toUpperCase(),

    official_half_lap: toNumberOrNull(
      firstValue(row.official_half_lap, row.half_lap_time)
    ),
    half_lap_time: toNumberOrNull(
      firstValue(row.official_half_lap, row.half_lap_time)
    ),

    official_lap: toNumberOrNull(
      firstValue(row.official_lap, row.lap_time)
    ),
    lap_time: toNumberOrNull(
      firstValue(row.official_lap, row.lap_time)
    ),

    official_turn: toNumberOrNull(
      firstValue(row.official_turn, row.turn_time)
    ),
    turn_time: toNumberOrNull(
      firstValue(row.official_turn, row.turn_time)
    ),

    official_straight: toNumberOrNull(
      firstValue(row.official_straight, row.straight_time)
    ),
    straight_time: toNumberOrNull(
      firstValue(row.official_straight, row.straight_time)
    ),

    exhibition_source: firstValue(row.exhibition_source, row.data_source),
    exhibition_synced_at: firstValue(
      row.exhibition_synced_at,
      row.api_synced_at,
      row.synced_at,
      row.updated_at
    ),

    tilt: toNumberOrNull(row.tilt),
    parts_changed: firstValue(row.parts_changed, row.parts_change),

    arrival_order: toIntegerOrNull(row.arrival_order),
    actual_course: toIntegerOrNull(row.actual_course),
    actual_start_timing: toNumberOrNull(row.actual_start_timing),
    actual_start_order: toIntegerOrNull(row.actual_start_order),
    race_time: toNumberOrNull(row.race_time),

    current_series_results: firstValue(
      row.current_series_results,
      row.series_results,
      ""
    ),

    synced_at: syncedAt,
    api_synced_at: syncedAt,
    updated_at: firstValue(row.updated_at, syncedAt),
  };
}

function mapEvent(row) {
  const syncedAt = firstValue(
    row.api_synced_at,
    row.synced_at,
    row.updated_at,
    row.created_at
  );

  return {
    ...row,

    race_date: row.race_date,
    opening_date: row.opening_date,

    course_code: Number(row.course_code),
    course_name: row.course_name || getCourseName(row.course_code),

    race_no: Number(row.race_no),
    race_day_no: toIntegerOrNull(row.race_day_no),
    race_kind_code: row.race_kind_code,
    is_fixed_entry: Boolean(row.is_fixed_entry),
    distance: toIntegerOrNull(row.distance),
    closing_time: row.closing_time,

    weather_code: row.weather_code,
    wind_direction_code: row.wind_direction_code,
    wind_speed: toNumberOrNull(row.wind_speed),
    wave_height: toNumberOrNull(row.wave_height),

    winning_technique_code: row.winning_technique_code,

exacta: row.exacta,
exacta_payout: toIntegerOrNull(row.exacta_payout),
exacta_popularity: toIntegerOrNull(row.exacta_popularity),

trifecta: row.trifecta,
trifecta_payout: toIntegerOrNull(row.trifecta_payout),
trifecta_popularity: toIntegerOrNull(row.trifecta_popularity),
    race_cancel_code: row.race_cancel_code,

    program_available: Boolean(row.program_available),
    result_available: Boolean(row.result_available),

    synced_at: syncedAt,
    api_synced_at: syncedAt,
    updated_at: firstValue(row.updated_at, syncedAt),
  };
}

function hasExhibitionData(entry) {
  return [
    entry.exhibition_time,
    entry.exhibition_st,
    entry.half_lap_time,
    entry.lap_time,
    entry.turn_time,
    entry.straight_time,
  ].some(hasValue);
}

function hasResultData(entry) {
  return [
    entry.arrival_order,
    entry.actual_course,
    entry.actual_start_timing,
    entry.race_time,
  ].some(hasValue);
}

function getRaceStatus(event, entries) {
  if (
    event.result_available ||
    entries.some((entry) => hasResultData(entry))
  ) {
    return "result";
  }

  if (entries.some((entry) => hasExhibitionData(entry))) {
    return "exhibition";
  }

  return "program";
}

function getRaceLatestSyncedAt(event, entries) {
  return getLatestIsoDate([
    event.api_synced_at,
    event.synced_at,
    event.updated_at,
    ...entries.flatMap((entry) => [
      entry.exhibition_synced_at,
      entry.api_synced_at,
      entry.synced_at,
      entry.updated_at,
    ]),
  ]);
}

function hasPredictionValue(row) {
  return [
    row?.ai_prediction,
    row?.prediction,
    row?.prediction_json,
    row?.ai_score,
    row?.confidence,
    row?.escape_probability,
    row?.recommendation,
    row?.recommended_bets,
  ].some(hasValue);
}

function getCourseLiveStatus({ raceCount, resultCount, exhibitionCount }) {
  if (raceCount > 0 && resultCount >= raceCount) {
    return "finished";
  }

  if (resultCount > 0) {
    return "live";
  }

  if (exhibitionCount > 0) {
    return "exhibition";
  }

  return "scheduled";
}


async function getLatestSuccessfulSyncAt(supabase, raceDate) {
  /*
   * bs_sync_logs の列構成が多少変わっても動くように、
   * select("*") で取得して JavaScript 側で最新日時を判定します。
   * テーブルがまだ無い環境では null を返し、開催データ側の時刻へフォールバックします。
   */
  try {
    let query = supabase
      .from("bs_sync_logs")
      .select("*")
      .limit(200);

    const { data, error } = await query;

    if (error) {
      console.warn("bs_sync_logs の取得をスキップしました:", error.message);
      return null;
    }

    const rows = (data ?? []).filter((row) => {
      const targetDate = firstValue(
        row.target_date,
        row.race_date,
        row.sync_date,
        row.date
      );

      const status = String(
        firstValue(row.status, row.result, row.state, "")
      ).toLowerCase();

      const isSuccess =
        !status ||
        ["success", "completed", "complete", "ok", "healthy"].includes(status);

      return (!targetDate || String(targetDate).slice(0, 10) === raceDate) && isSuccess;
    });

    return getLatestIsoDate(
      rows.flatMap((row) => [
        row.heartbeat_at,
        row.heartbeat,
        row.finished_at,
        row.completed_at,
        row.success_at,
        row.synced_at,
        row.api_synced_at,
        row.updated_at,
        row.created_at,
      ])
    );
  } catch (error) {
    console.warn("bs_sync_logs の最新時刻判定をスキップしました:", error);
    return null;
  }
}

export async function getAvailableDates(limit = 14) {
  const supabase = getSupabaseServerClient();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 14, 90));

  const { data, error } = await supabase
    .from("bs_race_events")
    .select("race_date")
    .order("race_date", { ascending: false })
    .limit(safeLimit * 24 * 12);

  if (error) {
    throw new Error(`開催日の取得に失敗しました: ${error.message}`);
  }

  return [
    ...new Set((data ?? []).map((row) => row.race_date).filter(Boolean)),
  ].slice(0, safeLimit);
}

export async function getCoursesByDate(raceDate) {
  const normalizedDate = normalizeDate(raceDate);
  const supabase = getSupabaseServerClient();

  const latestSuccessfulSyncAtPromise = getLatestSuccessfulSyncAt(
    supabase,
    normalizedDate
  );

  const [
    { data: eventRows, error: eventError },
    { data: entryRows, error: entryError },
  ] = await Promise.all([
    supabase
      .from("bs_race_events")
      .select("*")
      .eq("race_date", normalizedDate)
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: true }),

    supabase
      .from("bs_race_entries")
      .select("*")
      .eq("race_date", normalizedDate)
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: true })
      .order("boat_no", { ascending: true }),
  ]);

  if (eventError) {
    throw new Error(`開催一覧の取得に失敗しました: ${eventError.message}`);
  }

  if (entryError) {
    throw new Error(`出走艇一覧の取得に失敗しました: ${entryError.message}`);
  }

  const entriesByCourseRace = new Map();

  for (const rawEntry of entryRows ?? []) {
    const key = `${Number(rawEntry.course_code)}:${Number(rawEntry.race_no)}`;
    const currentEntries = entriesByCourseRace.get(key) ?? [];

    currentEntries.push(mapEntry(rawEntry));
    entriesByCourseRace.set(key, currentEntries);
  }

  const courseMap = new Map();

  for (const rawEvent of eventRows ?? []) {
    const event = mapEvent(rawEvent);
    const courseCode = Number(event.course_code);
    const raceNo = Number(event.race_no);
    const key = `${courseCode}:${raceNo}`;
    const entries = entriesByCourseRace.get(key) ?? [];

    const raceStatus = getRaceStatus(event, entries);
    const hasExhibition = raceStatus === "exhibition";
    const resultAvailable = raceStatus === "result";
    const closingAt = createClosingAt(normalizedDate, event.closing_time);
    const syncedAt = getRaceLatestSyncedAt(event, entries);

    const course = courseMap.get(courseCode) ?? {
      courseCode,
      courseName: event.course_name || getCourseName(courseCode),
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

    if (hasExhibition) {
      course.exhibitionCount += 1;
      course.startedExhibitionCount += 1;
    }

    if (resultAvailable) {
      course.resultCount += 1;
    }

    if (hasPredictionValue(rawEvent)) {
      course.hasAiPrediction = true;
      course.aiPublished = true;
      course.aiPredictionCount += 1;
    }

    course.races.push({
      raceNo,
      race_no: raceNo,

      raceStatus,
      race_status: raceStatus,

      closingTime: event.closing_time,
      closing_time: event.closing_time,

      closingAt,
      closing_at: closingAt,

      raceKindCode: event.race_kind_code,
      race_kind_code: event.race_kind_code,

      programAvailable: Boolean(event.program_available),
      program_available: Boolean(event.program_available),

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
    });

    course.syncedAt = getLatestIsoDate([course.syncedAt, syncedAt]);
    course.apiSyncedAt = course.syncedAt;

    course.exhibitionSyncedAt = getLatestIsoDate([
      course.exhibitionSyncedAt,
      ...entries.map((entry) => entry.exhibition_synced_at),
    ]);

    courseMap.set(courseCode, course);
  }

  const latestSuccessfulSyncAt = await latestSuccessfulSyncAtPromise;
  const now = Date.now();
  const today = getJstDateString();

  return [...courseMap.values()]
    .map((course) => {
      const races = [...course.races].sort(
        (a, b) => Number(a.raceNo) - Number(b.raceNo)
      );

      let nextRace = null;

      if (normalizedDate >= today) {
        nextRace =
          races.find((race) => {
            if (race.resultAvailable) return false;
            if (!race.closingAt) return true;

            const closingTimestamp = new Date(race.closingAt).getTime();

            return Number.isNaN(closingTimestamp) || closingTimestamp > now;
          }) ?? null;
      }

      const liveRace =
        races.find(
          (race) => race.hasExhibition && !race.resultAvailable
        ) ?? null;

      const liveStatus = getCourseLiveStatus({
        raceCount: course.raceCount,
        resultCount: course.resultCount,
        exhibitionCount: course.startedExhibitionCount,
      });

      const finalSyncedAt = getLatestIsoDate([
        latestSuccessfulSyncAt,
        course.syncedAt,
        course.apiSyncedAt,
        course.exhibitionSyncedAt,
      ]);

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

        syncedAt: finalSyncedAt,
        synced_at: finalSyncedAt,

        apiSyncedAt: finalSyncedAt,
        api_synced_at: finalSyncedAt,

        exhibitionSyncedAt: course.exhibitionSyncedAt,
        exhibition_synced_at: course.exhibitionSyncedAt,

        hasAiPrediction: Boolean(course.hasAiPrediction),
        has_ai_prediction: Boolean(course.hasAiPrediction),

        aiPublished: Boolean(course.aiPublished),
        ai_published: Boolean(course.aiPublished),
      };
    })
    .sort((a, b) => Number(a.courseCode) - Number(b.courseCode));
}

export async function getCourseRaces(raceDate, courseCode) {
  const normalizedDate = normalizeDate(raceDate);
  const normalizedCourseCode = normalizeCourseCode(courseCode);

  if (!normalizedCourseCode) {
    return [];
  }

  const supabase = getSupabaseServerClient();

  const [
    { data: eventRows, error: eventError },
    { data: entryRows, error: entryError },
  ] = await Promise.all([
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

  for (const rawEntry of entryRows ?? []) {
    const raceNo = Number(rawEntry.race_no);
    const currentEntries = entriesByRace.get(raceNo) ?? [];

    currentEntries.push(mapEntry(rawEntry));
    entriesByRace.set(raceNo, currentEntries);
  }

  return (eventRows ?? []).map((rawEvent) => {
    const event = mapEvent(rawEvent);
    const raceNo = Number(event.race_no);
    const entries = entriesByRace.get(raceNo) ?? [];
    const raceStatus = getRaceStatus(event, entries);
    const syncedAt = getRaceLatestSyncedAt(event, entries);
    const closingAt = createClosingAt(normalizedDate, event.closing_time);

    return {
      ...event,

      raceStatus,
      race_status: raceStatus,

      hasExhibition: raceStatus === "exhibition",
      has_exhibition: raceStatus === "exhibition",

      resultAvailable: raceStatus === "result",
      result_available: raceStatus === "result",

      closingAt,
      closing_at: closingAt,

      syncedAt,
      synced_at: syncedAt,

      apiSyncedAt: syncedAt,
      api_synced_at: syncedAt,

      entries,
    };
  });
}

export async function getCourseSummary(raceDate, courseCode) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);

  if (!normalizedCourseCode) {
    return null;
  }

  const courses = await getCoursesByDate(raceDate);

  return (
    courses.find(
      (course) => Number(course.courseCode) === normalizedCourseCode
    ) ?? null
  );
}

export async function getCourseLatestUpdate(raceDate, courseCode) {
  const course = await getCourseSummary(raceDate, courseCode);

  if (!course) return null;

  return firstValue(
    course.syncedAt,
    course.apiSyncedAt,
    course.exhibitionSyncedAt
  );
}

function normalizePredictionRow(row) {
  if (!row) return null;

  const parseJson = (value, fallback) => {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return fallback; }
  };

  return {
    ...row,
    score: toNumberOrNull(firstValue(row.score, row.escape_probability, row.confidence)),
    rank: firstValue(row.rank, row.grade, row.ai_rank),
    main_boat: toIntegerOrNull(firstValue(row.main_boat, row.main_boat_no, row.honmei_boat)),
    danger_level: firstValue(row.danger_level, row.danger_label),
    danger_score: toNumberOrNull(row.danger_score),
    comment_text: firstValue(row.comment_text, row.comment, row.ai_comment),
    bet_json: parseJson(firstValue(row.bet_json, row.recommended_bets), []),
    marks: parseJson(row.marks, []),
    factors: parseJson(row.factors, {}),
    score_before: toNumberOrNull(row.score_before),
    score_delta: toNumberOrNull(row.score_delta),

    // Ultimate v13: 前日版・直前版の表示項目を柔軟に受け取ります。
    escape_probability: toNumberOrNull(firstValue(row.escape_probability, row.in_escape_score)),
    motor_evaluation: firstValue(row.motor_evaluation, row.motor_grade, row.motor_score),
    st_evaluation: firstValue(row.st_evaluation, row.st_grade, row.st_score),
    local_evaluation: firstValue(row.local_evaluation, row.local_grade, row.local_score),
    similar_race_count: toIntegerOrNull(firstValue(row.similar_race_count, row.similar_count, row.sample_count)),
    past_performance: firstValue(row.past_performance, row.historical_result, row.historical_hit_rate),
    danger_point: firstValue(row.danger_point, row.danger_reason, row.danger_level),
    exhibition_grade: firstValue(row.exhibition_grade, row.exhibition_rank),
    upgraded_boat: toIntegerOrNull(firstValue(row.upgraded_boat, row.evaluation_up_boat)),
    downgraded_boat: toIntegerOrNull(firstValue(row.downgraded_boat, row.evaluation_down_boat)),
  };
}

export async function getRaceDetail(raceDate, courseCode, raceNo) {
  const normalizedDate = normalizeDate(raceDate);
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const normalizedRaceNo = normalizeRaceNo(raceNo);

  if (!normalizedCourseCode || !normalizedRaceNo) {
    return null;
  }

  const supabase = getSupabaseServerClient();

  const [
    { data: eventRow, error: eventError },
    { data: entryRows, error: entryError },
    { data: baseline, error: baselineError },
    { data: noteFeature, error: noteFeatureError },
    { data: predictionRows, error: predictionError },
  ] = await Promise.all([
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

    supabase
      .from("bs_course_baselines")
      .select("*")
      .eq("course_code", normalizedCourseCode)
      .maybeSingle(),

    supabase
      .from("bs_race_note_features")
      .select("*")
      .eq("race_date", normalizedDate)
      .eq("course_code", normalizedCourseCode)
      .eq("race_no", normalizedRaceNo)
      .eq("is_published", true)
      .maybeSingle(),

    supabase
      .from("bs_ai_predictions")
      .select("*")
      .eq("race_date", normalizedDate)
      .eq("course_code", normalizedCourseCode)
      .eq("race_no", normalizedRaceNo)
      .order("generated_at", { ascending: false }),
  ]);

  if (eventError) {
    throw new Error(`レース情報の取得に失敗しました: ${eventError.message}`);
  }

  if (entryError) {
    throw new Error(`レース詳細の取得に失敗しました: ${entryError.message}`);
  }

  if (baselineError) {
    console.warn(
      `場平均基準値の取得をスキップしました: ${baselineError.message}`
    );
  }

  if (noteFeatureError) {
    console.warn(
      `note連携情報の取得をスキップしました: ${noteFeatureError.message}`
    );
  }

  if (predictionError) {
    console.warn(
      `AI予測テーブルの取得をスキップし、Phase2自動計算を使用します: ${predictionError.message}`
    );
  }

  if (!eventRow || !entryRows?.length) {
    return null;
  }

  const event = mapEvent(eventRow);

  // bs_course_baselines の列名変更にも耐えられるよう、複数の候補を許容します。
  const venueBaselines = {
    exhibition: toNumberOrNull(
      firstValue(
        baseline?.avg_exhibition,
        baseline?.baseline_exhibition,
        baseline?.exhibition_baseline,
        baseline?.venue_average_exhibition_time
      )
    ),
    lap: toNumberOrNull(
      firstValue(
        baseline?.avg_lap,
        baseline?.baseline_lap,
        baseline?.lap_baseline,
        baseline?.venue_average_lap
      )
    ),
    turn: toNumberOrNull(
      firstValue(
        baseline?.avg_turn,
        baseline?.baseline_turn,
        baseline?.turn_baseline,
        baseline?.venue_average_turn
      )
    ),
    straight: toNumberOrNull(
      firstValue(
        baseline?.avg_straight,
        baseline?.baseline_straight,
        baseline?.straight_baseline,
        baseline?.venue_average_straight
      )
    ),
  };

  const entries = entryRows.map(mapEntry);

  const generatedPredictions = buildPhase2Predictions({ event, entries });
  const savedPrevious = (predictionRows ?? []).find((row) =>
    ["previous_day", "previous", "pre_day"].includes(String(row.timing || row.prediction_type || "").toLowerCase())
  );
  const savedLive = (predictionRows ?? []).find((row) =>
    ["after_exhibition", "live", "direct", "last_minute"].includes(String(row.timing || row.prediction_type || "").toLowerCase())
  );
  const previousPrediction = normalizePredictionRow(savedPrevious) ?? generatedPredictions.previousPrediction;
  const livePrediction = normalizePredictionRow(savedLive) ?? generatedPredictions.livePrediction;

  const raceStatus = getRaceStatus(event, entries);
  const syncedAt = getRaceLatestSyncedAt(event, entries);
  const resultEntries = entries.filter(
    (entry) => entry.arrival_order !== null
  );

  const result =
    raceStatus === "result"
      ? {
          winning_technique_code: event.winning_technique_code,

          exacta: event.exacta,
          exacta_payout: event.exacta_payout,
          exacta_popularity: event.exacta_popularity,

          trifecta: event.trifecta,
          trifecta_payout: event.trifecta_payout,
          trifecta_popularity: event.trifecta_popularity,
        }
      : null;

  return {
    event: {
      ...event,
      raceStatus,
      race_status: raceStatus,
      syncedAt,
      synced_at: syncedAt,
      apiSyncedAt: syncedAt,
      api_synced_at: syncedAt,

      // RaceDetailTabs の旧参照先にも基準値を公開します。
      venue_average_exhibition_time: venueBaselines.exhibition,
      baseline_exhibition_time: venueBaselines.exhibition,
      venue_average_lap: venueBaselines.lap,
      baseline_lap: venueBaselines.lap,
      venue_average_turn: venueBaselines.turn,
      baseline_turn: venueBaselines.turn,
      venue_average_straight: venueBaselines.straight,
      baseline_straight: venueBaselines.straight,
    },

    entries,

    previousPrediction,
    livePrediction,
    noteFeature: noteFeature ?? null,

    result,
    resultEntries,

    baseline: baseline ?? null,
    venueBaselines,
    baseline_exhibition: venueBaselines.exhibition,
  };
}


export async function getPublishedNoteFeaturesByDate(raceDate, pickupOnly = false) {
  const normalizedDate = normalizeDate(raceDate);
  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("bs_race_note_features")
    .select("*")
    .eq("race_date", normalizedDate)
    .eq("is_published", true)
    .order("is_pickup", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("course_code", { ascending: true })
    .order("race_no", { ascending: true });

  if (pickupOnly) query = query.eq("is_pickup", true);
  const { data, error } = await query;
  if (error) {
    console.warn(`note連携一覧の取得をスキップしました: ${error.message}`);
    return [];
  }
  return data ?? [];
}

/**
 * 出走表トップ用のAI的中速報。
 * テーブル未作成の環境でもトップページを止めないよう、失敗時は空配列を返します。
 */
export async function getAiBetHitFlashByDate(raceDate, limit = 6) {
  const normalizedDate = normalizeDate(raceDate);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 6, 20));
  const supabase = getSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("bs_ai_bet_results")
      .select("*")
      .eq("race_date", normalizedDate)
      .eq("is_hit", true)
      .order("settled_at", { ascending: false })
      .limit(safeLimit);

    if (error) {
      console.warn(`AI的中速報の取得をスキップしました: ${error.message}`);
      return [];
    }

    return data ?? [];
  } catch (error) {
    console.warn("AI的中速報の取得をスキップしました:", error);
    return [];
  }
}
