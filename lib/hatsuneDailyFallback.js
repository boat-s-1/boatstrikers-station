import { createClient } from "@supabase/supabase-js";

const COURSE_NAMES = {
  1: "桐生", 2: "戸田", 3: "江戸川", 4: "平和島", 5: "多摩川", 6: "浜名湖",
  7: "蒲郡", 8: "常滑", 9: "津", 10: "三国", 11: "びわこ", 12: "住之江",
  13: "尼崎", 14: "鳴門", 15: "丸亀", 16: "児島", 17: "宮島", 18: "徳山",
  19: "下関", 20: "若松", 21: "芦屋", 22: "福岡", 23: "唐津", 24: "大村",
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理用環境変数が未設定です。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstDate(offsetDays = 0) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  return now.toISOString().slice(0, 10);
}

function compactDate(date) {
  return String(date || "").replaceAll("-", "");
}

function isFemale(entry) {
  if (Number(entry.sex_code) === 2) return true;
  const value = `${entry.gender || ""} ${entry.gender_code || ""}`.toLowerCase();
  return value.includes("女") || value.includes("female") || /(^|\s)(2|f)(\s|$)/.test(value);
}

function racePageUrl(date, courseCode, raceNo) {
  const c = String(courseCode).padStart(2, "0");
  return `https://www.boatrace.jp/owpc/pc/race/racelist?rno=${raceNo}&jcd=${c}&hd=${compactDate(date)}`;
}

function motorRate(entry) {
  const rate = Number(entry.motor_2_rate ?? entry.motor_top2_rate);
  return Number.isFinite(rate) ? rate : null;
}

export async function ensureHatsuneDailyMinimum() {
  const supabase = getAdminSupabase();
  const tomorrow = jstDate(1);
  const sourceKey = `bs:daily-minimum:${tomorrow}`;

  const { data: existing, error: existingError } = await supabase
    .from("hatsune_news")
    .select("id,title")
    .eq("source_key", sourceKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { inserted: false, existing };

  const { data: entries, error: entriesError } = await supabase
    .from("bs_race_entries")
    .select("race_date,course_code,race_no,racer_name,sex_code,gender,gender_code,motor_no,motor_number,motor_2_rate,motor_top2_rate")
    .eq("race_date", tomorrow);
  if (entriesError) throw entriesError;

  const femaleEntries = (entries || []).filter(isFemale);
  let article;

  if (femaleEntries.length) {
    const byCourse = new Map();
    for (const entry of femaleEntries) {
      const code = Number(entry.course_code);
      if (!byCourse.has(code)) byCourse.set(code, []);
      byCourse.get(code).push(entry);
    }
    const [courseCode, courseEntries] = [...byCourse.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const place = COURSE_NAMES[courseCode] || `場コード${courseCode}`;
    const topMotor = [...courseEntries]
      .map((entry) => ({ entry, rate: motorRate(entry) }))
      .filter((x) => x.rate !== null)
      .sort((a, b) => b.rate - a.rate)[0];
    const first = courseEntries[0];

    if (topMotor) {
      const racer = String(topMotor.entry.racer_name || "注目女子レーサー").trim();
      const motorNo = topMotor.entry.motor_no ?? topMotor.entry.motor_number;
      article = {
        title: `明日の女子レーサー注目｜${place}の${racer}選手をチェック`,
        summary: `${tomorrow}は${place}に女子レーサー${courseEntries.length}走分の出走を確認。中でも${racer}選手の${motorNo || "注目"}号機はモーター2連対率${topMotor.rate.toFixed(1)}%。明日の展示・スタート気配とあわせて初音NEWSで注目します。`,
        place,
        sourceUrl: racePageUrl(tomorrow, courseCode, topMotor.entry.race_no || first.race_no),
      };
    } else {
      const names = [...new Set(courseEntries.map((x) => String(x.racer_name || "").trim()).filter(Boolean))].slice(0, 3);
      article = {
        title: `明日の女子レーサー注目｜${place}をチェック`,
        summary: `${tomorrow}は${place}に女子レーサー${courseEntries.length}走分の出走を確認。${names.length ? `${names.join("・")}選手など` : "女子レーサー"}の出走、展示タイム、スタート気配を初音NEWSで追います。`,
        place,
        sourceUrl: racePageUrl(tomorrow, courseCode, first.race_no),
      };
    }
  } else {
    article = {
      title: `明日の女子ボートNEWS｜${tomorrow}の出走表をチェック`,
      summary: `${tomorrow}の女子レーサー出走データは、現時点のBoatStrikersレースDBではまだ確認できていません。出走表の更新後に女子戦・女子レーサー・高モーター情報を追記します。`,
      place: null,
      sourceUrl: "https://www.boatrace.jp/owpc/pc/race/index",
    };
  }

  const { data, error } = await supabase
    .from("hatsune_news")
    .insert({
      title: article.title,
      summary: article.summary,
      category: "tomorrow",
      source_type: "bs_data",
      source_name: "BoatStrikers レースDB",
      source_url: article.sourceUrl,
      source_key: sourceKey,
      image_url: null,
      place: article.place,
      published_at: new Date().toISOString(),
      is_featured: false,
      priority: 55,
      article_body: null,
      article_body_source: "template",
      collected_at: new Date().toISOString(),
      is_published: true,
    })
    .select("id,title,source_key")
    .single();
  if (error) throw error;

  return { inserted: true, item: data };
}
