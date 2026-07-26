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
    exhibition_st: toNumberOrNull(row.exhibition_st),
    exhibition_fl: firstValue(row.exhibition_fl, row.show_fl),

   half_lap_time: toNumberOrNull(
  firstValue(row.official_half_lap, row.half_lap_time)
),

lap_time: toNumberOrNull(
  firstValue(row.official_lap, row.lap_time)
),

turn_time: toNumberOrNull(
  firstValue(row.official_turn, row.turn_time)
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







  
 // 場平均基準値取得
const { data: baseline } = await supabase
  .from("bs_course_baselines")
  .select("*")
  .eq("course_code", normalizedCourseCode)
  .maybeSingle();

const event = mapEvent(eventRow);

const entries = entryRows.map((row) => {
  const entry = mapEntry(row);

  const baselineExhibition = baseline?.avg_exhibition ?? null;

  return {
    ...entry,

    // 場平均展示
    baseline_exhibition: baselineExhibition,

    // 場平均との差
    venue_diff_exhibition:
      entry.exhibition_time != null &&
      baselineExhibition != null
        ? Number(
            (
              entry.exhibition_time -
              baselineExhibition
            ).toFixed(2)
          )
        : null,
  };
});


  
  const raceStatus = getRaceStatus(event, entries);
  const syncedAt = getRaceLatestSyncedAt(event, entries);
  const resultEntries = entries.filter(
    (entry) => entry.arrival_order !== null
  );

  const result =
  raceStatus === "result"
    ? {
        winning_technique_code:
          event.winning_technique_code,

        exacta: event.exacta,
        exacta_payout: event.exacta_payout,
        exacta_popularity:
          event.exacta_popularity,

        trifecta: event.trifecta,
        trifecta_payout: event.trifecta_payout,
        trifecta_popularity:
          event.trifecta_popularity,
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
    },

    entries,

    previousPrediction: null,
    livePrediction: null,

    result,
    resultEntries,

    baseline: baseline ?? null,

    
  };
}
