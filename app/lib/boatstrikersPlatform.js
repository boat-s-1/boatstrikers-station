import { createClient } from "@supabase/supabase-js";

async function fetchAllRows(buildQuery) {
  const rows = [];
  const pageSize = 1000;

  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);

    if (error) throw error;

    rows.push(...(data || []));

    if (!data || data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

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

function parseClosingTimestamp(raceDate, closingTime) {
  if (!raceDate || !closingTime) {
    return null;
  }

  const timeText = String(closingTime).trim();

  /*
   * Supabaseのtime型
   * 11:33:00
   * 11:33:00+00
   * などから時・分・秒だけ取得
   */
  const match = timeText.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?/
  );

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const ss = String(second).padStart(2, "0");

  const timestamp = Date.parse(
    `${raceDate}T${hh}:${mm}:${ss}+09:00`
  );

  return Number.isFinite(timestamp)
    ? timestamp
    : null;
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

  let events = [];
  let exhibitionEntries = [];
  let results = [];

  try {
    [events, exhibitionEntries, results] =
      await Promise.all([
        fetchAllRows((from, to) =>
          supabase
            .from("bs_race_events")
            .select(
  `
  race_date,
  course_code,
  race_no,
  race_status,
  weather,
  synced_at,
  closing_time
  `
)
            .eq("race_date", raceDate)
            .order("course_code", {
              ascending: true,
            })
            .order("race_no", {
              ascending: true,
            })
            .range(from, to)
        ),

        fetchAllRows((from, to) =>
          supabase
            .from("bs_race_entries")
            .select(
              "course_code,race_no,boat_no,exhibition_time,exhibition_st,synced_at"
            )
            .eq("race_date", raceDate)
            .order("course_code", {
              ascending: true,
            })
            .order("race_no", {
              ascending: true,
            })
            .order("boat_no", {
              ascending: true,
            })
            .range(from, to)
        ),

        fetchAllRows((from, to) =>
          supabase
            .from("bs_race_results")
            .select(
              "course_code,race_no,synced_at"
            )
            .eq("race_date", raceDate)
            .order("course_code", {
              ascending: true,
            })
            .order("race_no", {
              ascending: true,
            })
            .range(from, to)
        ),
      ]);
  } catch (error) {
    throw new Error(
      `開催場一覧の取得に失敗しました: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
  }

  const exhibitionMap = new Map();

  for (const entry of exhibitionEntries) {
    const courseCode = Number(
      entry.course_code
    );

    const raceNo = Number(
      entry.race_no
    );

    const key = `${courseCode}-${raceNo}`;

    if (!exhibitionMap.has(key)) {
      exhibitionMap.set(key, {
        timeCount: 0,
        stCount: 0,
      });
    }

    const exhibition =
      exhibitionMap.get(key);

    if (
      entry.exhibition_time !== null &&
      entry.exhibition_time !== undefined
    ) {
      exhibition.timeCount += 1;
    }

    if (
      entry.exhibition_st !== null &&
      entry.exhibition_st !== undefined
    ) {
      exhibition.stCount += 1;
    }
  }

  const resultRaceSet = new Set();

  for (const result of results) {
    const courseCode = Number(
      result.course_code
    );

    const raceNo = Number(
      result.race_no
    );

    resultRaceSet.add(
      `${courseCode}-${raceNo}`
    );
  }

  const grouped = new Map();

  for (const event of events) {
    const courseCode = Number(
      event.course_code
    );

    const raceNo = Number(
      event.race_no
    );

    const raceKey =
      `${courseCode}-${raceNo}`;

    if (!grouped.has(courseCode)) {
     grouped.set(courseCode, {
  raceDate: event.race_date,
  courseCode,
  courseName: getCourseName(courseCode),

  raceCount: 0,
  startedExhibitionCount: 0,
  exhibitionCount: 0,
  completeExhibitionCount: 0,
  resultCount: 0,

  /*
   * 次に締切を迎えるレース
   */
  nextRaceNo: null,
  nextClosingTime: null,
  nextClosingAt: null,

  /*
   * 締切済み・結果待ちのレース
   */
  liveRaceNo: null,
  liveClosingAt: null,

  weather: event.weather,
  syncedAt: event.synced_at,
});
    }

    const item = grouped.get(courseCode);

const exhibition =
  exhibitionMap.get(raceKey);

const hasResult =
  resultRaceSet.has(raceKey);

const closingAt =
  parseClosingTimestamp(
    event.race_date,
    event.closing_time
  );

const nowTimestamp = Date.now();

item.raceCount += 1;

/*
 * 次に締切を迎える未確定レース
 */
if (
  !hasResult &&
  closingAt !== null &&
  closingAt > nowTimestamp &&
  (
    item.nextClosingAt === null ||
    closingAt < item.nextClosingAt
  )
) {
  item.nextRaceNo = raceNo;
  item.nextClosingTime =
    event.closing_time;
  item.nextClosingAt = closingAt;
}

/*
 * 締切済みで結果がまだないレース
 *
 * 同じ場で複数ある場合は、
 * 最も新しく締切を迎えたレースを採用
 */
if (
  !hasResult &&
  closingAt !== null &&
  closingAt <= nowTimestamp &&
  (
    item.liveClosingAt === null ||
    closingAt > item.liveClosingAt
  )
) {
  item.liveRaceNo = raceNo;
  item.liveClosingAt = closingAt;
}

    if (
      exhibition &&
      (
        exhibition.timeCount > 0 ||
        exhibition.stCount > 0
      )
    ) {
      item.startedExhibitionCount += 1;
    }

    if (
      exhibition?.timeCount === 6
    ) {
      item.exhibitionCount += 1;
    }

    if (
      exhibition?.timeCount === 6 &&
      exhibition?.stCount === 6
    ) {
      item.completeExhibitionCount += 1;
    }

    if (
      resultRaceSet.has(raceKey)
    ) {
      item.resultCount += 1;
    }

    if (
      event.synced_at &&
      (
        !item.syncedAt ||
        event.synced_at >
          item.syncedAt
      )
    ) {
      item.syncedAt =
        event.synced_at;
    }
  }

  return [...grouped.values()]
  .map((course) => {
    let liveStatus = "scheduled";

    const nowTimestamp = Date.now();

    const millisecondsUntilClosing =
      course.nextClosingAt !== null
        ? course.nextClosingAt - nowTimestamp
        : null;

    /*
     * 締切15分前から展示中と判定
     */
    const exhibitionWindowMilliseconds =
      15 * 60 * 1000;

    /*
     * 🔵 全レース結果確定
     */
    if (
      course.raceCount > 0 &&
      course.resultCount >= course.raceCount
    ) {
      liveStatus = "finished";
    }

    /*
     * 🔴 締切済みで結果待ちのレースがある
     */
    else if (course.liveRaceNo !== null) {
      liveStatus = "live";
    }

    /*
     * 🟡 次の締切まで15分以内
     */
    else if (
      millisecondsUntilClosing !== null &&
      millisecondsUntilClosing >= 0 &&
      millisecondsUntilClosing <=
        exhibitionWindowMilliseconds
    ) {
      liveStatus = "exhibition";
    }

    /*
     * 🟢 それ以前
     */
    else {
      liveStatus = "scheduled";
    }

    return {
      ...course,
      liveStatus,
    };
  })
  .sort(
    (a, b) =>
      a.courseCode - b.courseCode
  );
}
export async function getCourseRaces(raceDate, courseCode) {
  const supabase = getSupabase();

  const [events, entries] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("bs_race_events")
        .select("*")
        .eq("race_date", raceDate)
        .eq("course_code", courseCode)
        .order("race_no", { ascending: true })
        .order("synced_at", { ascending: false })
        .range(from, to)
    ),

    fetchAllRows((from, to) =>
      supabase
        .from("bs_race_entries")
        .select(
          [
            "race_no",
            "boat_no",
            "racer_name",
            "racer_class",
            "national_win_rate",
            "local_win_rate",
            "motor_no",
            "motor_2_rate",
            "boat_machine_no",
            "boat_2_rate",
            "exhibition_time",
            "exhibition_st",
            "synced_at",
          ].join(",")
        )
        .eq("race_date", raceDate)
        .eq("course_code", courseCode)
        .order("race_no", { ascending: true })
        .order("boat_no", { ascending: true })
        .order("synced_at", { ascending: false })
        .range(from, to)
    ),
  ]);

  /*
   * レース番号ごとに1件だけ残す
   * synced_atが新しい行を優先
   */
  const eventMap = new Map();

  for (const event of events) {
    const raceNo = Number(event.race_no);

    if (!Number.isInteger(raceNo)) {
      continue;
    }

    const current = eventMap.get(raceNo);

    if (
      !current ||
      String(event.synced_at || "") >
        String(current.synced_at || "")
    ) {
      eventMap.set(raceNo, {
        ...event,
        race_no: raceNo,
      });
    }
  }

  /*
   * レース番号＋艇番ごとに1件だけ残す
   */
  const entryMap = new Map();

  for (const entry of entries) {
    const raceNo = Number(entry.race_no);
    const boatNo = Number(entry.boat_no);

    if (
      !Number.isInteger(raceNo) ||
      !Number.isInteger(boatNo)
    ) {
      continue;
    }

    const key = `${raceNo}-${boatNo}`;
    const current = entryMap.get(key);

    if (
      !current ||
      String(entry.synced_at || "") >
        String(current.synced_at || "")
    ) {
      entryMap.set(key, {
        ...entry,
        race_no: raceNo,
        boat_no: boatNo,
      });
    }
  }

  /*
   * レースごとに艇をまとめる
   */
  const entriesByRace = new Map();

  for (const entry of entryMap.values()) {
    const raceNo = Number(entry.race_no);

    if (!entriesByRace.has(raceNo)) {
      entriesByRace.set(raceNo, []);
    }

    entriesByRace.get(raceNo).push(entry);
  }

  for (const raceEntries of entriesByRace.values()) {
    raceEntries.sort(
      (a, b) =>
        Number(a.boat_no) - Number(b.boat_no)
    );
  }

  return [...eventMap.values()]
    .sort(
      (a, b) =>
        Number(a.race_no) - Number(b.race_no)
    )
    .map((event) => ({
      ...event,
      entries:
        entriesByRace.get(Number(event.race_no)) || [],
    }));
}

export async function getRaceDetail(raceDate, courseCode, raceNo) {
  const supabase = getSupabase();

  const [
    { data: event, error: eventError },
    { data: entries, error: entryError },
    { data: predictions, error: predictionError },
    { data: result, error: resultError },
    { data: resultEntries, error: resultEntriesError },
  ] = await Promise.all([
    // レース基本情報
    supabase
      .from("bs_race_events")
      .select("*")
      .eq("race_date", raceDate)
      .eq("course_code", courseCode)
      .eq("race_no", raceNo)
      .maybeSingle(),

    // 出走艇情報
    supabase
      .from("bs_race_entries")
      .select("*")
      .eq("race_date", raceDate)
      .eq("course_code", courseCode)
      .eq("race_no", raceNo)
      .order("boat_no", { ascending: true }),

    // 一果AI予測
    supabase
      .from("bs_ai_predictions")
      .select("*")
      .eq("race_date", raceDate)
      .eq("course_code", courseCode)
      .eq("race_no", raceNo)
      .eq("character_code", "ichika")
      .eq("published", true),

    // レース単位の結果
    supabase
      .from("bs_race_results")
      .select("*")
      .eq("race_date", raceDate)
      .eq("course_code", courseCode)
      .eq("race_no", raceNo)
      .maybeSingle(),

    // 艇別の着順・進入・ST
    supabase
      .from("bs_race_result_entries")
      .select("*")
      .eq("race_date", raceDate)
      .eq("course_code", courseCode)
      .eq("race_no", raceNo)
      .order("boat_no", { ascending: true }),
  ]);

  if (eventError) {
    throw new Error(
      `レース情報の取得に失敗しました: ${eventError.message}`
    );
  }

  if (entryError) {
    throw new Error(
      `出走表の取得に失敗しました: ${entryError.message}`
    );
  }

  if (predictionError) {
    console.error(
      "AI予測取得エラー:",
      predictionError.message
    );
  }

  /*
   * レース前は結果テーブルにデータがないため、
   * maybeSingle()がnullを返すのは正常です。
   */
  if (resultError) {
    console.error(
      "レース結果取得エラー:",
      resultError.message
    );
  }

  if (resultEntriesError) {
    console.error(
      "艇別結果取得エラー:",
      resultEntriesError.message
    );
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

    previousPrediction:
      predictionMap.previous_day || null,

    livePrediction:
      predictionMap.after_exhibition || null,

    // 今回追加
    result: result || null,
    resultEntries: resultEntries || [],
  };
}
