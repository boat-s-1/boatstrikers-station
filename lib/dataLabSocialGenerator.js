import { createClient } from "@supabase/supabase-js";
import { generateDailyResultDigest } from "./dailyResultDigest";

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

function buildOutputs(digest) {
  const lab = digest.data_lab || {};
  const manshu = Array.isArray(digest.manshu) ? digest.manshu : [];
  const incidents = Array.isArray(digest.incidents) ? digest.incidents : [];
  const featured = Array.isArray(digest.featured_races) ? digest.featured_races : [];
  const top = manshu[0] || null;
  const date = displayDate(digest.race_date);
  const manshuRate = Number(lab.manshu_rate || 0).toFixed(2);
  const escapeRate = digest.race_count ? ((Number(lab.escape_wins || 0) / digest.race_count) * 100).toFixed(1) : "0.0";

  const xLines = [
    `📊 ${date} BoatStrikers DATA LAB`,
    `${digest.venue_count}場・${digest.race_count}Rを集計`,
    `💰万舟 ${digest.manshu_count}本（${manshuRate}%）`,
    top ? `最高配当 ${top.venue}${top.race_no}R ${top.trifecta} ${yen(top.payout)}` : "最高配当 万舟なし",
    `🚤1号艇1着 ${lab.boat1_wins || 0}R｜5号艇1着 ${lab.boat5_wins || 0}R`,
    `🏁逃げ ${lab.escape_wins || 0}R（${escapeRate}%）`,
    `⚠️事故・異常着 ${incidents.length}R`,
    "昨日のボートレースを数字で振り返る。",
  ];

  const shortScript = [
    `${date}のボートレースを30秒で振り返ります。`,
    `昨日は全国${digest.venue_count}場、合計${digest.race_count}レース。`,
    `3連単1万円以上の万舟は${digest.manshu_count}本、万舟率は${manshuRate}パーセントでした。`,
    top ? `最高配当は${top.venue}${top.race_no}レース、${top.trifecta}で${yen(top.payout)}。` : "万舟の最高配当データはありません。",
    `1号艇の1着は${lab.boat1_wins || 0}レース、5号艇の1着は${lab.boat5_wins || 0}レース。`,
    `逃げ決着は${lab.escape_wins || 0}レース、全体の${escapeRate}パーセント。`,
    incidents.length ? `事故・異常着があったのは${incidents.length}レースでした。` : "事故・異常着の対象レースはありませんでした。",
    "詳しい結果はBoatStrikers DATA LABでチェック。",
  ].join(" ");

  const venueManshu = {};
  for (const row of manshu) venueManshu[row.venue] = (venueManshu[row.venue] || 0) + 1;
  const venueRanking = Object.entries(venueManshu)
    .map(([venue, count]) => ({ venue, count }))
    .sort((a, b) => b.count - a.count || a.venue.localeCompare(b.venue, "ja"));

  const imagePayload = {
    template: "data_lab_yesterday_numbers_v1",
    title: "昨日のボートレースを数字で見る",
    date,
    headline: top ? `万舟${digest.manshu_count}本・最高${yen(top.payout)}` : `万舟${digest.manshu_count}本`,
    stats: [
      { label: "開催", value: `${digest.venue_count}場 / ${digest.race_count}R` },
      { label: "万舟", value: `${digest.manshu_count}本` },
      { label: "万舟率", value: `${manshuRate}%` },
      { label: "1号艇1着", value: `${lab.boat1_wins || 0}R` },
      { label: "5号艇1着", value: `${lab.boat5_wins || 0}R` },
      { label: "逃げ", value: `${lab.escape_wins || 0}R (${escapeRate}%)` },
    ],
    max_payout: top ? { venue: top.venue, race_no: top.race_no, trifecta: top.trifecta, payout: top.payout } : null,
    venue_manshu_ranking: venueRanking.slice(0, 5),
    incident_races: incidents.length,
    featured_races: featured.length,
    brand: "BoatStrikers DATA LAB",
  };

  return {
    x_post_text: xLines.join("\n"),
    short_script: shortScript,
    image_payload: imagePayload,
    hashtags: ["#ボートレース", "#BoatStrikers"],
  };
}

export async function generateDataLabSocialOutputs({ date } = {}) {
  const client = getClient();
  const raceDate = date || jstYesterday();

  let { data: digest, error } = await client
    .from("bs_daily_result_digests")
    .select("id,race_date,status,race_count,venue_count,manshu_count,max_payout,manshu,incidents,featured_races,data_lab")
    .eq("race_date", raceDate)
    .maybeSingle();
  if (error) throw error;

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

  const outputs = buildOutputs(digest);
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

  return { ok: true, ...saved };
}
