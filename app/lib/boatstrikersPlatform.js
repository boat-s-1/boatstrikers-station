import { createClient } from "@supabase/supabase-js";

const COURSE_NAMES = {
  1: "桐生", 2: "戸田", 3: "江戸川", 4: "平和島",
  5: "多摩川", 6: "浜名湖", 7: "蒲郡", 8: "常滑",
  9: "津", 10: "三国", 11: "びわこ", 12: "住之江",
  13: "尼崎", 14: "鳴門", 15: "丸亀", 16: "児島",
  17: "宮島", 18: "徳山", 19: "下関", 20: "若松",
  21: "芦屋", 22: "福岡", 23: "唐津", 24: "大村",
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "VercelのNEXT_PUBLIC_SUPABASE_URLとNEXT_PUBLIC_SUPABASE_ANON_KEYを設定してください。"
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init = {}) =>
        fetch(input, {
          ...init,
          cache: "no-store",
        }),
    },
  });
}

export function getCourseName(code) {
  return COURSE_NAMES[Number(code)] || `${Number(code)}場`;
}

export function getTodayJst() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function normalizeDate(value) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : getTodayJst();
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
  return String(value || "選手名未取得")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "-";
}

export function formatJstDateTime(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

export async function getAvailableDates(limit = 14) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("bs_race_events")
    .select("race_date")
    .order("race_date", { ascending: false })
    .limit(1500);

  if (error) {
    throw new Error(`開催日の取得に失敗しました: ${error.message}`);
  }

  return [...new Set((data || []).map((row) => row.race_date))].slice(0, limit);
}

export async function getCoursesByDate(raceDate) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("bs_race_events")
    .select("race_date,course_code,race_no,race_status,weather,synced_at")
    .eq("race_date", raceDate)
    .order("course_code", { ascending: true })
    .order("race_no", { ascending: true });

  if (error) {
    throw new Error(`開催場一覧の取得に失敗しました: ${error.message}`);
  }

  const grouped = new Map();

  for (const row of data || []) {
    if (!grouped.has(row.course_code)) {
      grouped.set(row.course_code, {
        raceDate: row.race_date,
        courseCode: row.course_code,
        courseName: getCourseName(row.course_code),
        raceCount: 0,
        exhibitionCount: 0,
        weather: row.weather,
        syncedAt: row.synced_at,
      });
    }

    const item = grouped.get(row.course_code);
    item.raceCount += 1;

    if (row.race_status === "exhibition") {
      item.exhibitionCount += 1;
    }

    if (row.synced_at && (!item.syncedAt || row.synced_at > item.syncedAt)) {
      item.syncedAt = row.synced_at;
    }
  }

  return [...grouped.values()];
}

export async function getCourseRaces(raceDate, courseCode) {
  const supabase = getSupabase();

  const [{ data: events, error: eventError }, { data: entries, error: entryError }] =
    await Promise.all([
      supabase
        .from("bs_race_events")
        .select("*")
        .eq("race_date", raceDate)
        .eq("course_code", courseCode)
        .order("race_no", { ascending: true }),

      supabase
        .from("bs_race_entries")
        .select(
          "race_no,boat_no,racer_name,racer_class,national_win_rate,local_win_rate,exhibition_time,exhibition_st,synced_at"
        )
        .eq("race_date", raceDate)
        .eq("course_code", courseCode)
        .order("race_no", { ascending: true })
        .order("boat_no", { ascending: true }),
    ]);

  if (eventError) {
    throw new Error(`レース一覧の取得に失敗しました: ${eventError.message}`);
  }

  if (entryError) {
    throw new Error(`選手一覧の取得に失敗しました: ${entryError.message}`);
  }

  const byRace = new Map();

  for (const entry of entries || []) {
    if (!byRace.has(entry.race_no)) {
      byRace.set(entry.race_no, []);
    }
    byRace.get(entry.race_no).push(entry);
  }

  return (events || []).map((event) => ({
    ...event,
    entries: byRace.get(event.race_no) || [],
  }));
}

export async function getRaceDetail(raceDate, courseCode, raceNo) {
  const supabase = getSupabase();

  const [
    { data: event, error: eventError },
    { data: entries, error: entryError },
    { data: predictions, error: predictionError },
  ] = await Promise.all([
    supabase
      .from("bs_race_events")
      .select("*")
      .eq("race_date", raceDate)
      .eq("course_code", courseCode)
      .eq("race_no", raceNo)
      .maybeSingle(),

    supabase
      .from("bs_race_entries")
      .select("*")
      .eq("race_date", raceDate)
      .eq("course_code", courseCode)
      .eq("race_no", raceNo)
      .order("boat_no", { ascending: true }),

    supabase
      .from("bs_ai_predictions")
      .select("*")
      .eq("race_date", raceDate)
      .eq("course_code", courseCode)
      .eq("race_no", raceNo)
      .eq("character_code", "ichika")
      .eq("published", true),
  ]);

  if (eventError) {
    throw new Error(`レース情報の取得に失敗しました: ${eventError.message}`);
  }

  if (entryError) {
    throw new Error(`出走表の取得に失敗しました: ${entryError.message}`);
  }

  if (predictionError) {
    console.error("AI予測取得エラー:", predictionError.message);
  }

  const predictionMap = Object.fromEntries(
    (predictions || []).map((prediction) => [
      prediction.timing,
      prediction,
    ])
  );

  return {
    event,
    entries: entries || [],
    previousPrediction: predictionMap.previous_day || null,
    livePrediction: predictionMap.after_exhibition || null,
  };
}
