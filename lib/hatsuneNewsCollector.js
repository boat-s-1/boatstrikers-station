import { createClient } from "@supabase/supabase-js";

const OFFICIAL_NEWS_URL = "https://www.boatrace.jp/owpc/pc/site/news/";
const WOMEN_KEYWORDS = [
  "レディース",
  "女子",
  "ヴィーナス",
  "オールレディース",
  "クイーンズ",
  "女王",
  "女子レーサー",
  "レディースチャンピオン",
  "レディースオールスター",
  "水神祭",
];

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

function normalizeSpace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function absoluteOfficialUrl(href) {
  try {
    return new URL(href, OFFICIAL_NEWS_URL).toString();
  } catch {
    return OFFICIAL_NEWS_URL;
  }
}

function officialCategory(title) {
  if (title.includes("水神祭")) return "suijinsai";
  if (/A1|A2|B1|B2|昇格|級別/.test(title)) return "grade";
  if (/優勝|優出/.test(title)) return "win";
  return "women";
}

function isFemale(entry) {
  if (Number(entry.sex_code) === 2) return true;
  const value = `${entry.gender || ""} ${entry.gender_code || ""}`.toLowerCase();
  return value.includes("女") || value.includes("female") || /(^|\s)(2|f)(\s|$)/.test(value);
}

function groupByRace(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = `${row.race_date}:${row.course_code}:${row.race_no}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function eventMap(rows) {
  return new Map((rows || []).map((row) => [`${row.race_date}:${row.course_code}:${row.race_no}`, row]));
}

function racePageUrl(date, courseCode, raceNo) {
  const c = String(courseCode).padStart(2, "0");
  return `https://www.boatrace.jp/owpc/pc/race/racelist?rno=${raceNo}&jcd=${c}&hd=${compactDate(date)}`;
}

async function insertCandidates(supabase, candidates) {
  if (!candidates.length) return { inserted: [], skipped: [] };

  const titles = [...new Set(candidates.map((x) => x.title))];
  const keys = [...new Set(candidates.map((x) => x.source_key).filter(Boolean))];
  const existingTitles = new Set();
  const existingKeys = new Set();

  if (titles.length) {
    const { data } = await supabase.from("hatsune_news").select("title").in("title", titles);
    for (const row of data || []) existingTitles.add(row.title);
  }
  if (keys.length) {
    const { data } = await supabase.from("hatsune_news").select("source_key").in("source_key", keys);
    for (const row of data || []) if (row.source_key) existingKeys.add(row.source_key);
  }

  const fresh = candidates.filter((x) => !existingTitles.has(x.title) && !existingKeys.has(x.source_key));
  if (!fresh.length) return { inserted: [], skipped: candidates.map((x) => x.source_key) };

  const payload = fresh.map((item) => ({
    ...item,
    article_body: null,
    article_body_source: "template",
    collected_at: new Date().toISOString(),
    is_published: true,
  }));
  const { data, error } = await supabase.from("hatsune_news").insert(payload).select("id,title,source_key");
  if (error) throw error;
  return { inserted: data || [], skipped: candidates.filter((x) => !fresh.includes(x)).map((x) => x.source_key) };
}

async function collectOfficialNews() {
  const response = await fetch(OFFICIAL_NEWS_URL, {
    headers: { "User-Agent": "BoatStrikers/1.0 (+https://www.boat-strike.online/)" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`BOAT RACE公式ニュース取得失敗: ${response.status}`);
  const html = await response.text();
  const candidates = [];
  const seen = new Set();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(html))) {
    const title = normalizeSpace(decodeHtml(match[2]));
    if (title.length < 12 || !WOMEN_KEYWORDS.some((keyword) => title.includes(keyword))) continue;
    const sourceUrl = absoluteOfficialUrl(match[1]);
    if (seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const before = html.slice(Math.max(0, match.index - 260), match.index);
    const dateMatches = [...before.matchAll(/(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/g)];
    const last = dateMatches.at(-1);
    const date = last
      ? `${last[1]}-${String(last[2]).padStart(2, "0")}-${String(last[3]).padStart(2, "0")}`
      : jstDate(0);
    candidates.push({
      title,
      summary: `BOAT RACEオフィシャルウェブサイトで公開された女子ボートレース関連のお知らせです。初音NEWSでは要点を整理して紹介します。`,
      category: officialCategory(title),
      source_type: "official",
      source_name: "BOAT RACE オフィシャルウェブサイト",
      source_url: sourceUrl,
      source_key: `official:${sourceUrl}`,
      image_url: null,
      place: null,
      published_at: `${date}T09:00:00+09:00`,
      is_featured: false,
      priority: 30,
    });
    if (candidates.length >= 20) break;
  }
  return candidates;
}

async function collectRaceData(supabase) {
  const today = jstDate(0);
  const tomorrow = jstDate(1);
  const [{ data: entries, error: entriesError }, { data: events, error: eventsError }] = await Promise.all([
    supabase
      .from("bs_race_entries")
      .select("race_date,course_code,race_no,racer_name,sex_code,gender,gender_code,motor_no,motor_2_rate,motor_number,motor_top2_rate")
      .gte("race_date", today)
      .lte("race_date", tomorrow),
    supabase
      .from("bs_race_events")
      .select("race_date,course_code,race_no,race_name,course_name,result_available,race_day_no,trifecta,trifecta_payout,winning_technique_code")
      .gte("race_date", today)
      .lte("race_date", tomorrow),
  ]);
  if (entriesError) throw entriesError;
  if (eventsError) throw eventsError;

  const races = groupByRace(entries);
  const eventsByKey = eventMap(events);
  const womenRaces = [];
  for (const [key, boats] of races) {
    if (boats.length !== 6 || !boats.every(isFemale)) continue;
    womenRaces.push({ key, boats, event: eventsByKey.get(key) || null });
  }

  const candidates = [];
  const tomorrowByCourse = new Map();
  for (const race of womenRaces.filter((x) => x.boats[0]?.race_date === tomorrow)) {
    const courseCode = Number(race.boats[0].course_code);
    if (!tomorrowByCourse.has(courseCode)) tomorrowByCourse.set(courseCode, []);
    tomorrowByCourse.get(courseCode).push(race);
  }
  for (const [courseCode, rows] of tomorrowByCourse) {
    const place = rows[0]?.event?.course_name || COURSE_NAMES[courseCode] || `場コード${courseCode}`;
    const eventNames = [...new Set(rows.map((x) => normalizeSpace(x.event?.race_name)).filter(Boolean))];
    const eventText = eventNames[0] ? `「${eventNames[0]}」` : "女子戦";
    candidates.push({
      title: `明日の${place}は${eventText}に注目`,
      summary: `${tomorrow}の${place}では女子選手だけで構成されるレースを${rows.length}レース確認。出走表・モーター・展示を初音NEWSで追います。`,
      category: "tomorrow",
      source_type: "bs_data",
      source_name: "BoatStrikers レースDB",
      source_url: racePageUrl(tomorrow, courseCode, rows[0].boats[0].race_no),
      source_key: `bs:tomorrow:${tomorrow}:${courseCode}`,
      image_url: null,
      place,
      published_at: new Date().toISOString(),
      is_featured: false,
      priority: 60,
    });
  }

  const todayByCourse = new Map();
  for (const race of womenRaces.filter((x) => x.boats[0]?.race_date === today)) {
    const courseCode = Number(race.boats[0].course_code);
    if (!todayByCourse.has(courseCode)) todayByCourse.set(courseCode, []);
    todayByCourse.get(courseCode).push(race);
  }

  for (const [courseCode, rows] of todayByCourse) {
    const place = rows[0]?.event?.course_name || COURSE_NAMES[courseCode] || `場コード${courseCode}`;
    const firstDay = rows.some((x) => Number(x.event?.race_day_no) === 1);
    if (firstDay) {
      const unique = new Map();
      for (const race of rows) {
        for (const boat of race.boats) {
          const motorNo = boat.motor_no ?? boat.motor_number;
          const rate = Number(boat.motor_2_rate ?? boat.motor_top2_rate);
          if (!motorNo || !Number.isFinite(rate)) continue;
          const key = `${boat.racer_name}:${motorNo}`;
          if (!unique.has(key) || rate > unique.get(key).rate) unique.set(key, { name: boat.racer_name, motorNo, rate });
        }
      }
      const top = [...unique.values()].sort((a, b) => b.rate - a.rate)[0];
      if (top) {
        candidates.push({
          title: `${place}女子戦の高モーターは${top.name}の${top.motorNo}号機・2連対率${top.rate.toFixed(1)}%`,
          summary: `${place}の女子戦初日データから、出場選手のモーター2連対率を比較。現時点のトップは${top.name}選手の${top.motorNo}号機で${top.rate.toFixed(1)}%です。`,
          category: "motor",
          source_type: "bs_data",
          source_name: "BoatStrikers レースDB",
          source_url: racePageUrl(today, courseCode, rows[0].boats[0].race_no),
          source_key: `bs:motor:${today}:${courseCode}`,
          image_url: null,
          place,
          published_at: new Date().toISOString(),
          is_featured: false,
          priority: 70,
        });
      }
    }

    const finished = rows.filter((x) => x.event?.result_available);
    if (finished.length) {
      const notable = finished.find((x) => /優勝戦|ドリーム/.test(x.event?.race_name || "")) || finished.sort((a, b) => Number(b.boats[0].race_no) - Number(a.boats[0].race_no))[0];
      const winner = notable.boats.find((b) => Number(b.arrival_order) === 1) || null;
      const raceNo = notable.boats[0].race_no;
      const raceName = normalizeSpace(notable.event?.race_name) || `${raceNo}R`;
      const resultDetail = notable.event?.trifecta ? `3連単は${notable.event.trifecta}` : "結果が確定";
      candidates.push({
        title: `${place}${raceNo}R ${raceName}の結果を更新`,
        summary: `${today}の${place}${raceNo}Rは${resultDetail}。女子戦の当日結果として初音NEWSに記録しました。`,
        category: "result",
        source_type: "bs_data",
        source_name: "BoatStrikers レースDB",
        source_url: racePageUrl(today, courseCode, raceNo),
        source_key: `bs:result:${today}:${courseCode}:${raceNo}`,
        image_url: null,
        place,
        published_at: new Date().toISOString(),
        is_featured: /優勝戦/.test(raceName),
        priority: /優勝戦/.test(raceName) ? 90 : 50,
      });
    }
  }
  return candidates;
}

export async function collectHatsuneNews() {
  const supabase = getAdminSupabase();
  const report = { official: { found: 0, inserted: 0 }, raceData: { found: 0, inserted: 0 }, errors: [] };

  try {
    const official = await collectOfficialNews();
    report.official.found = official.length;
    const result = await insertCandidates(supabase, official);
    report.official.inserted = result.inserted.length;
  } catch (error) {
    report.errors.push(`official: ${error?.message || String(error)}`);
  }

  try {
    const raceData = await collectRaceData(supabase);
    report.raceData.found = raceData.length;
    const result = await insertCandidates(supabase, raceData);
    report.raceData.inserted = result.inserted.length;
  } catch (error) {
    report.errors.push(`raceData: ${error?.message || String(error)}`);
  }

  report.inserted = report.official.inserted + report.raceData.inserted;
  return report;
}
