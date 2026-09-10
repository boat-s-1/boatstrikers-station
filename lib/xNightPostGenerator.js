import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function normalizeDate(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("date は YYYY-MM-DD 形式で指定してください。");
  return s;
}

const yen = (n) => `${Number(n || 0).toLocaleString("ja-JP")}円`;
const combo = (s) => String(s || "").replace(/[^1-6]/g, "").split("").join("-");

function resultText(row, character) {
  const base = `${row.course_name}${row.race_no}Rは${combo(row.trifecta)}、3連単${yen(row.trifecta_payout)}。1着は${row.first_boat}号艇 ${row.first_racer_name}選手。`;
  if (character === "ichika") return `${base}${row.first_boat === 1 ? "イン頭でも相手次第で配当は変わります。" : "1号艇が敗れた条件も振り返りたい結果です。"}`;
  if (character === "hatsune") return `${base}${row.has_female_entry ? "女子選手が絡む結果としてチェックしておきたいです。" : ""}`.trim();
  if (character === "kiina") return `${base}${row.first_boat >= 4 ? "外枠頭の決着、こういう形はキイナ的に要チェック👀" : ""}`.trim();
  return `${base} BoatStrikersの確定結果DBから確認済みです。`;
}

function pickUnique(rows, max = 3) {
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    const key = `${row.course_code}-${row.race_no}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= max) break;
  }
  return out;
}

export async function generateXNightPostsFromSnapshot({ date } = {}) {
  const client = getClient();
  const raceDate = normalizeDate(date || jstToday());
  const { data: snapshot, error } = await client.from("bs_x_night_snapshots").select("race_date,news_count,result_count,payload,generated_at").eq("race_date", raceDate).maybeSingle();
  if (error) throw error;
  if (!snapshot) throw new Error(`${raceDate} の夜X snapshotがありません。`);

  const payload = snapshot.payload || {};
  const news = Array.isArray(payload.news) ? payload.news : [];
  const groups = payload.groups || {};
  const results = Array.isArray(payload.results) ? payload.results : [];
  if (results.length !== Number(snapshot.result_count || 0) || news.length !== Number(snapshot.news_count || 0)) {
    throw new Error(`${raceDate} のsnapshot件数が不整合です。`);
  }

  const newsPosts = news.map((x) => x.x_post_text).filter(Boolean).slice(0, 8);
  const ichika = pickUnique(groups.ichika || [], 3).map((x) => resultText(x, "ichika"));
  const hatsune = pickUnique(groups.hatsune || [], 3).map((x) => resultText(x, "hatsune"));
  const kiina = pickUnique(groups.kiina || [], 3).map((x) => resultText(x, "kiina"));
  const official = pickUnique([...(groups.manshu || []), ...results], 3).map((x) => resultText(x, "official"));

  const topRows = pickUnique([...(groups.boat5_wins || []), ...(groups.outer_wins || []), ...(groups.manshu || []), ...(groups.boat1_wins || [])], 5);
  const top5 = topRows.map((x) => ({ character: x.first_boat === 1 ? "ichika" : x.has_female_entry ? "hatsune" : x.first_boat >= 4 ? "kiina" : "boatstrikers", text: resultText(x, x.first_boat === 1 ? "ichika" : x.has_female_entry ? "hatsune" : x.first_boat >= 4 ? "kiina" : "official") }));

  const posts = {
    source: "bs_x_night_snapshots",
    snapshot_generated_at: snapshot.generated_at,
    news_posts: newsPosts,
    ichika,
    hatsune,
    kiina,
    boatstrikers: official,
    top5,
    reaction_top3: top5.slice(0, 3),
    unused_interesting_results: pickUnique(groups.manshu || [], 12).slice(5).map((x) => ({ venue: x.course_name, race_no: x.race_no, trifecta: combo(x.trifecta), payout: x.trifecta_payout }))
  };

  const { error: upsertError } = await client.from("bs_x_night_posts").upsert({ race_date: raceDate, snapshot_generated_at: snapshot.generated_at, snapshot_news_count: snapshot.news_count, snapshot_result_count: snapshot.result_count, posts, generated_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "race_date" });
  if (upsertError) throw upsertError;

  return { ok: true, race_date: raceDate, source: "snapshot_only", news_count: snapshot.news_count, result_count: snapshot.result_count, ichika_count: ichika.length, hatsune_count: hatsune.length, kiina_count: kiina.length, top5_count: top5.length };
}
