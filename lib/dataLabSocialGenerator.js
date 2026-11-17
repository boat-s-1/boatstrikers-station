
import { DATA_LAB_COMMENTS } from "./editorial/copyPolicy.mjs";
import { reviewFreeTextFields } from "./editorial/reviewGeneratedCopy.mjs";
import { createClient } from "@supabase/supabase-js";
import { generateDailyResultDigest } from "./dailyResultDigest.js";
import { fetchTechniqueMap, raceKey, summarizeTechniques } from "./winningTechnique.js";
import { summarizeIncidents } from "./raceIncidents.js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstYesterday() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const d = new Date(`${obj.year}-${obj.month}-${obj.day}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(d);
}

function displayDate(date) {
  const [, m, d] = String(date).split("-");
  return `${Number(m)}/${Number(d)}`;
}

function yen(v) { return Number(v || 0).toLocaleString("ja-JP") + "円"; }

function trifectaText(value) {
  const s = String(value || "").replace(/[^1-6]/g, "");
  return s.length === 3 ? s.split("").join("-") : String(value || "");
}

function isWomenRaceByName(event) {
  const text = `${event?.race_name || ""} ${event?.series_name || ""} ${event?.event_name || ""}`;
  return /オールレディース|ヴィーナス|女子|レディース/i.test(text);
}

function raceView(event) {
  return {
    course_code: event.course_code,
    venue: event.course_name || `場コード${event.course_code}`,
    race_no: event.race_no,
    trifecta: trifectaText(event.trifecta),
    payout: Number(event.trifecta_payout || 0),
  };
}

function venueTopBy(rows, limit = 3) {
  const map = new Map();
  for (const row of rows) {
    const key = row.venue;
    const prev = map.get(key) || { venue: key, count: 0, race_count: 0 };
    prev.count += Number(row.count || 0);
    prev.race_count += Number(row.race_count || 0);
    map.set(key, prev);
  }
  return [...map.values()]
    .map((x) => ({ ...x, rate: x.race_count ? Number(((x.count / x.race_count) * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.rate - a.rate || b.count - a.count || a.venue.localeCompare(b.venue, "ja"))
    .slice(0, limit);
}

function characterComments({ ichika, hatsune, kiina }) {
  ichika.comment = ichika.escape_rate == null
    ? "決まり手が確定していないレースがあるため、逃げの集計は見送りました。"
    : ichika.escape_rate >= 60
    ? "イン逃げが目立った1日。イン中心で組み立てやすい結果でした。"
    : ichika.escape_rate <= 45
      ? "イン崩れが目立つ1日。1号艇の過信には注意したい結果でした。"
      : "イン逃げとイン崩れが混在。場ごとの傾向確認が重要な1日でした。";

  hatsune.comment = hatsune.women_race_count === 0
    ? "女子戦として判定できるレースは確認できませんでした。"
    : hatsune.women_manshu_count >= 3
      ? "女子戦は波乱寄り。万舟も複数出て、読み応えのある1日でした。"
      : hatsune.women_escape_rate != null && hatsune.women_escape_rate >= 60
        ? "女子戦は比較的イン優勢。逃げ中心で素直な流れが目立ちました。"
        : "女子戦はイン一辺倒ではなく、相手選びが重要な1日でした。";

  kiina.comment = kiina.manshu_count >= 20
    ? DATA_LAB_COMMENTS.many
    : kiina.outer_head_big_payout_count >= 3
      ? DATA_LAB_COMMENTS.outer
      : DATA_LAB_COMMENTS.other;
}

async function loadRaceData(client, raceDate) {
  const [{ data: events, error: eventError }, { data: entries, error: entryError }, techniqueMap] = await Promise.all([
    client.from("bs_race_events")
      .select("course_code,course_name,race_no,race_name,trifecta,trifecta_payout,result_available,race_cancel_code")
      .eq("race_date", raceDate)
      .eq("result_available", true)
      .order("course_code").order("race_no"),
    client.from("bs_race_entries")
      .select("course_code,race_no,boat_no,racer_name,arrival_order,gender_code,result_code,finish_place")
      .eq("race_date", raceDate)
      .order("course_code").order("race_no").order("boat_no"),
    fetchTechniqueMap(client, raceDate),
  ]);
  if (eventError) throw eventError;
  if (entryError) throw entryError;
  return { events: events || [], entries: entries || [], techniqueMap };
}

// 事故レース数も実行時点の出走表から数え直す（23:10 の digest は異常コードの同期前で「確認中」のことがある）
export function summarizeDataLabIncidents(events, entries) {
  return summarizeIncidents((events || []).filter((x) => !String(x.race_cancel_code || "").trim()), entries);
}

// DB を読まずに集計する部分（検証でも同じ関数を使う）
export function buildCharacterDetailsFrom({ events, entries, techniqueMap, digest }) {
  const validEvents = (events || []).filter((x) => !String(x.race_cancel_code || "").trim());
  const winnerMap = new Map();
  const entriesByRace = new Map();
  for (const row of entries || []) {
    const key = `${row.course_code}-${row.race_no}`;
    if (!entriesByRace.has(key)) entriesByRace.set(key, []);
    entriesByRace.get(key).push(row);
    if (row.arrival_order === 1) winnerMap.set(key, Number(row.boat_no));
  }

  // 決まり手は確定結果の文字列だけで判定する。1レースでも欠けていれば、逃げの件数・率は出さない（null）。
  const techniques = summarizeTechniques(validEvents, techniqueMap);
  const escapeKnown = techniques.status === "complete";
  const isEscape = (event) => techniqueMap.get(raceKey(event)) === "逃げ";
  const escapeEvents = validEvents.filter(isEscape);
  const nonEscapeEvents = validEvents.filter((x) => techniqueMap.has(raceKey(x)) && !isEscape(x));
  const ichikaVenueRows = [];
  const byVenue = new Map();
  for (const event of validEvents) {
    const venue = event.course_name || `場コード${event.course_code}`;
    const prev = byVenue.get(venue) || { venue, race_count: 0, count: 0 };
    prev.race_count += 1;
    if (isEscape(event)) prev.count += 1;
    byVenue.set(venue, prev);
  }
  if (escapeKnown) ichikaVenueRows.push(...byVenue.values());
  const ichikaUpsets = nonEscapeEvents
    .map(raceView)
    .sort((a, b) => b.payout - a.payout || a.course_code - b.course_code || a.race_no - b.race_no)
    .slice(0, 3);

  let genderJudgedRaceCount = 0;
  let genderFallbackRaceCount = 0;
  let incompleteGenderRaceCount = 0;
  const womenEvents = validEvents.filter((event) => {
    const key = `${event.course_code}-${event.race_no}`;
    const raceEntries = entriesByRace.get(key) || [];
    const sixEntries = raceEntries.length === 6;
    const genderCodes = raceEntries.map((row) => String(row.gender_code || "").trim());
    const allKnown = sixEntries && genderCodes.every((code) => code === "1" || code === "2");

    if (allKnown) {
      genderJudgedRaceCount += 1;
      return genderCodes.every((code) => code === "2");
    }

    if (raceEntries.length > 0) incompleteGenderRaceCount += 1;
    const byName = isWomenRaceByName(event);
    if (byName) genderFallbackRaceCount += 1;
    return byName;
  });

  const womenManshu = womenEvents.filter((x) => Number(x.trifecta_payout || 0) >= 10000).map(raceView)
    .sort((a, b) => b.payout - a.payout || a.race_no - b.race_no);
  const womenBoat1Wins = womenEvents.filter((x) => winnerMap.get(`${x.course_code}-${x.race_no}`) === 1).length;
  const womenEscapes = escapeKnown ? womenEvents.filter(isEscape).length : null;
  const womenFeatured = [...womenEvents].map(raceView)
    .sort((a, b) => b.payout - a.payout || a.course_code - b.course_code || a.race_no - b.race_no)
    .slice(0, 3);

  const allPayouts = validEvents.map(raceView)
    .sort((a, b) => b.payout - a.payout || a.course_code - b.course_code || a.race_no - b.race_no);
  const outerHeadBigPayout = validEvents.filter((event) => {
    const winner = winnerMap.get(`${event.course_code}-${event.race_no}`);
    return [4, 5, 6].includes(winner) && Number(event.trifecta_payout || 0) >= 10000;
  }).length;
  const manshu = Array.isArray(digest.manshu) ? digest.manshu : [];
  const roughVenueMap = new Map();
  for (const row of manshu) {
    const venue = row.venue || `場コード${row.course_code}`;
    const prev = roughVenueMap.get(venue) || { venue, count: 0, max_payout: 0 };
    prev.count += 1;
    prev.max_payout = Math.max(prev.max_payout, Number(row.payout || 0));
    roughVenueMap.set(venue, prev);
  }
  const roughVenues = [...roughVenueMap.values()]
    .sort((a, b) => b.count - a.count || b.max_payout - a.max_payout || a.venue.localeCompare(b.venue, "ja"))
    .slice(0, 3);

  const ichika = {
    escape_success_count: escapeKnown ? escapeEvents.length : null,
    escape_failure_count: escapeKnown ? validEvents.length - escapeEvents.length : null,
    escape_rate: escapeKnown ? Number(((escapeEvents.length / validEvents.length) * 100).toFixed(1)) : null,
    technique_counts: techniques.counts,
    technique_status: techniques.status,
    technique_missing_races: techniques.missing_races,
    strong_venues: venueTopBy(ichikaVenueRows, 3),
    upset_races: ichikaUpsets,
    comment: "",
  };
  const hatsune = {
    women_race_count: womenEvents.length,
    women_boat1_wins: womenBoat1Wins,
    women_escape_count: womenEscapes,
    women_escape_rate: womenEscapes == null ? null : womenEvents.length ? Number(((womenEscapes / womenEvents.length) * 100).toFixed(1)) : 0,
    women_manshu_count: womenManshu.length,
    women_max_payout: womenManshu[0] || null,
    rough_races: womenManshu.slice(0, 3),
    featured_races: womenFeatured,
    detection_method: "six_entries_gender_code_priority",
    gender_rule: "gender_code=2を女子、gender_code=1を男子として、6艇すべて女子なら女子戦。性別不足時のみレース名で補完。",
    gender_judged_race_count: genderJudgedRaceCount,
    name_fallback_race_count: genderFallbackRaceCount,
    incomplete_gender_race_count: incompleteGenderRaceCount,
    comment: "",
  };
  const kiina = {
    manshu_count: Number(digest.manshu_count || manshu.length || 0),
    manshu_rate: Number(digest.data_lab?.manshu_rate || 0),
    max_payout: manshu[0] || null,
    boat5_wins: Number(digest.data_lab?.boat5_wins || 0),
    outer_head_big_payout_count: outerHeadBigPayout,
    rough_venues: roughVenues,
    payout_top5: allPayouts.slice(0, 5),
    comment: "",
  };
  characterComments({ ichika, hatsune, kiina });
  return { ichika, hatsune, kiina };
}

export function buildOutputs(digest, characterDetails, incidentSummary) {
  const lab = digest.data_lab || {};
  const manshu = Array.isArray(digest.manshu) ? digest.manshu : [];
  // 事故レース数：同期を確認できた場合だけ件数を出す。確認できなければ null（表示は「集計確認中」）
  const incidentRaces = incidentSummary
    ? incidentSummary.race_count
    : lab.incident_status === "complete" ? Number(lab.incident_race_count ?? 0) : null;
  const featured = Array.isArray(digest.featured_races) ? digest.featured_races : [];
  const top = manshu[0] || null;
  const date = displayDate(digest.race_date);
  const manshuRate = Number(lab.manshu_rate || 0).toFixed(2);
  // 逃げの件数は保存済みの digest.data_lab ではなく、確定結果の決まり手から数え直した値を使う（古い集計の誤りを引き継がない）
  const escapeWins = characterDetails?.ichika?.escape_success_count ?? null;
  const escapeRate = escapeWins != null && digest.race_count ? ((escapeWins / digest.race_count) * 100).toFixed(1) : null;

  const xLines = [
    `📊 ${date} BoatStrikers DATA LAB`,
    `${digest.venue_count}場・${digest.race_count}Rを集計`,
    `💰万舟 ${digest.manshu_count}本（${manshuRate}%）`,
    top ? `最高配当 ${top.venue}${top.race_no}R ${top.trifecta} ${yen(top.payout)}` : "最高配当 万舟なし",
    `🚤1号艇1着 ${lab.boat1_wins || 0}R｜5号艇1着 ${lab.boat5_wins || 0}R`,
    escapeWins != null ? `🏁逃げ ${escapeWins}R（${escapeRate}%）` : null,
    incidentRaces == null ? "⚠️事故レース 集計確認中" : `⚠️事故レース ${incidentRaces}R`,
    "昨日のボートレースを数字で振り返る。",
  ].filter((line) => line != null);

  const shortScript = [
    `${date}のボートレースを30秒で振り返ります。`,
    `昨日は全国${digest.venue_count}場、合計${digest.race_count}レース。`,
    `3連単1万円以上の万舟は${digest.manshu_count}本、万舟率は${manshuRate}パーセントでした。`,
    top ? `最高配当は${top.venue}${top.race_no}レース、${top.trifecta}で${yen(top.payout)}。` : "万舟の最高配当データはありません。",
    `1号艇の1着は${lab.boat1_wins || 0}レース、5号艇の1着は${lab.boat5_wins || 0}レース。`,
    escapeWins != null ? `逃げ決着は${escapeWins}レース、全体の${escapeRate}パーセント。` : null,
    incidentRaces == null ? "事故レースは集計確認中です。" : incidentRaces ? `事故レースは${incidentRaces}レースでした。` : "事故レースはありませんでした。",
    "詳しい結果はBoatStrikers DATA LABでチェック。",
  ].filter((line) => line != null).join(" ");

  const venueManshu = {};
  for (const row of manshu) venueManshu[row.venue] = (venueManshu[row.venue] || 0) + 1;
  const venueRanking = Object.entries(venueManshu)
    .map(([venue, count]) => ({ venue, count }))
    .sort((a, b) => b.count - a.count || a.venue.localeCompare(b.venue, "ja"));

  const imagePayload = {
    template: "data_lab_yesterday_numbers_v3",
    title: "昨日のボートレースを数字で見る",
    date,
    headline: top ? `万舟${digest.manshu_count}本・最高${yen(top.payout)}` : `万舟${digest.manshu_count}本`,
    stats: [
      { label: "開催", value: `${digest.venue_count}場 / ${digest.race_count}R` },
      { label: "万舟", value: `${digest.manshu_count}本` },
      { label: "万舟率", value: `${manshuRate}%` },
      { label: "1号艇1着", value: `${lab.boat1_wins || 0}R` },
      { label: "5号艇1着", value: `${lab.boat5_wins || 0}R` },
      ...(escapeWins != null ? [{ label: "逃げ", value: `${escapeWins}R (${escapeRate}%)` }] : []),
    ],
    max_payout: top ? { venue: top.venue, race_no: top.race_no, trifecta: top.trifecta, payout: top.payout } : null,
    venue_manshu_ranking: venueRanking.slice(0, 5),
    incident_races: incidentRaces,
    incident_status: incidentRaces == null ? "incomplete" : "complete",
    incident_label: "事故レース",
    incident_count_rule: "対象事象が1件以上発生したユニークなレース数。同一レースで複数艇が該当しても1R。",
    featured_races: featured.length,
    character_details: characterDetails,
    brand: "BoatStrikers DATA LAB",
  };

  return {
    x_post_text: xLines.join("\n"),
    short_script: shortScript,
    image_payload: imagePayload,
    hashtags: ["#ボートレース", "#BoatStrikers"],
  };
}

// generateDigestIfMissing：前日の digest が無いときに日次まとめ（記事公開を含む）を作るか。Cron は従来どおり true、管理画面は false。
export async function generateDataLabSocialOutputs({ date, generateDigestIfMissing = true } = {}) {
  const client = getClient();
  const raceDate = date || jstYesterday();

  let { data: digest, error } = await client
    .from("bs_daily_result_digests")
    .select("id,race_date,status,race_count,venue_count,manshu_count,max_payout,manshu,incidents,featured_races,data_lab")
    .eq("race_date", raceDate)
    .maybeSingle();
  if (error) throw error;

  if (!digest && !generateDigestIfMissing) throw new Error(`${raceDate} の日次まとめ（digest）がまだありません。DATA LAB は日次まとめの生成後に作成できます。`);

  if (!digest) {
    await generateDailyResultDigest({ date: raceDate });
    const result = await client
      .from("bs_daily_result_digests")
      .select("id,race_date,status,race_count,venue_count,manshu_count,max_payout,manshu,incidents,featured_races,data_lab")
      .eq("race_date", raceDate)
      .maybeSingle();
    if (result.error) throw result.error;
    digest = result.data;
  }

  if (!digest || digest.status !== "complete") throw new Error(`${raceDate} の日次結果集計が未完了です。`);

  const { events, entries, techniqueMap } = await loadRaceData(client, raceDate);
  const characterDetails = buildCharacterDetailsFrom({ events, entries, techniqueMap, digest });
  const incidentSummary = summarizeDataLabIncidents(events, entries);
  const outputs = buildOutputs(digest, characterDetails, incidentSummary);
  const now = new Date().toISOString();
  const { data: saved, error: saveError } = await client
    .from("bs_data_lab_social_outputs")
    .upsert({
      race_date: raceDate,
      status: "draft",
      source_digest_id: digest.id,
      ...outputs,
      generated_at: now,
      updated_at: now,
    }, { onConflict: "race_date" })
    .select("id,race_date,status,x_post_text,short_script,image_payload,hashtags,generated_at")
    .single();
  if (saveError) throw saveError;

  return { ok: true, ...saved, copy_review: reviewFreeTextFields({ x_post_text: saved.x_post_text, short_script: saved.short_script }) };
}