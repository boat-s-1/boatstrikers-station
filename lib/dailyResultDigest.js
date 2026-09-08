import { createClient } from "@supabase/supabase-js";

const RESULT_CODE_LABELS = {
  F: "フライング",
  L0: "出遅れ",
  L1: "出遅れ（責任外）",
  K0: "欠場",
  K1: "欠場（責任外）",
  S0: "失格",
  S1: "失格（責任外）",
  S2: "他艇を妨害",
};

const WINNING_TECHNIQUE_LABELS = {
  "1": "抜き",
  "2": "逃げ",
  "3": "まくり",
  "4": "まくり差し",
  "5": "差し",
  "6": "恵まれ",
};

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstYesterday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const noonUtc = new Date(`${obj.year}-${obj.month}-${obj.day}T12:00:00+09:00`);
  noonUtc.setUTCDate(noonUtc.getUTCDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(noonUtc);
}

function normalizeDate(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("date は YYYY-MM-DD 形式で指定してください。");
  return s;
}

function displayDate(date) {
  const [, m, d] = date.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

function cleanName(name) {
  return String(name || "").replace(/[\s　]+/g, "").trim();
}

function trifectaText(value) {
  const s = String(value || "").replace(/[^1-6]/g, "");
  return s.length === 3 ? s.split("").join("-") : String(value || "");
}

function formatYen(value) {
  return `${Number(value || 0).toLocaleString("ja-JP")}円`;
}

function isFinalRace(event) {
  return String(event?.race_kind_code || "") === "0021" || /優勝戦/.test(String(event?.race_name || ""));
}

function isDreamRace(event) {
  return /ドリーム|DREAM|\bDR\b/i.test(String(event?.race_name || ""));
}

function groupEntries(entries) {
  const map = new Map();
  for (const entry of entries || []) {
    const key = `${entry.course_code}-${entry.race_no}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  }
  for (const rows of map.values()) rows.sort((a, b) => a.boat_no - b.boat_no);
  return map;
}

function makeFeaturedRace(event, rows) {
  const resultRows = [...rows].sort((a, b) => {
    const aa = Number.isInteger(a.arrival_order) ? a.arrival_order : 99;
    const bb = Number.isInteger(b.arrival_order) ? b.arrival_order : 99;
    return aa - bb || a.boat_no - b.boat_no;
  });
  const winner = resultRows.find((x) => x.arrival_order === 1);
  return {
    type: isFinalRace(event) ? "優勝戦" : "ドリーム戦",
    course_code: event.course_code,
    venue: event.course_name || `場コード${event.course_code}`,
    race_no: event.race_no,
    race_name: event.race_name || (isFinalRace(event) ? "優勝戦" : "ドリーム戦"),
    trifecta: trifectaText(event.trifecta),
    trifecta_payout: event.trifecta_payout,
    winning_technique: WINNING_TECHNIQUE_LABELS[String(event.winning_technique_code || "")] || null,
    winner: winner ? { boat_no: winner.boat_no, racer_name: cleanName(winner.racer_name) } : null,
    entrants: rows.map((x) => ({
      boat_no: x.boat_no,
      racer_name: cleanName(x.racer_name),
      arrival_order: x.arrival_order,
      result_code: x.result_code,
    })),
  };
}

function buildArticle({ raceDate, raceCount, venueCount, manshu, incidents, featured, dataLab }) {
  const dateText = displayDate(raceDate);
  const max = manshu[0] || null;
  const lines = [];
  lines.push(`${dateText}のボートレース結果を、万舟・事故/異常着・優勝戦/ドリーム戦の3項目でまとめます。`);
  lines.push("");
  lines.push("## 今日の数字");
  lines.push(`- 開催：${venueCount}場 / ${raceCount}R`);
  lines.push(`- 3連単万舟：${manshu.length}本（万舟率 ${dataLab.manshu_rate}%）`);
  if (max) lines.push(`- 最高配当：${max.venue}${max.race_no}R ${max.trifecta} ${formatYen(max.payout)}`);
  lines.push(`- 1号艇1着：${dataLab.boat1_wins}R`);
  lines.push(`- 5号艇1着：${dataLab.boat5_wins}R`);
  lines.push(`- 逃げ決着：${dataLab.escape_wins}R`);

  lines.push("");
  lines.push("## 万舟決着");
  if (!manshu.length) lines.push("3連単10,000円以上の万舟はありませんでした。");
  for (const item of manshu) lines.push(`- ${item.venue}${item.race_no}R：${item.trifecta} / ${formatYen(item.payout)}`);

  lines.push("");
  lines.push("## 事故・異常着");
  if (!incidents.length) lines.push("対象となるフライング・出遅れ・欠場・失格は確認されませんでした。");
  for (const race of incidents) {
    const detail = race.items.map((x) => `${x.boat_no}号艇 ${x.racer_name}：${x.label}`).join("、");
    lines.push(`- ${race.venue}${race.race_no}R：${detail}`);
  }

  lines.push("");
  lines.push("## 優勝戦・ドリーム戦");
  if (!featured.length) lines.push("対象レースは確認されませんでした。");
  for (const race of featured) {
    const top3 = [...race.entrants]
      .filter((x) => Number.isInteger(x.arrival_order) && x.arrival_order <= 3)
      .sort((a, b) => a.arrival_order - b.arrival_order)
      .map((x) => `${x.arrival_order}着 ${x.boat_no}号艇 ${x.racer_name}`)
      .join(" / ");
    lines.push(`- ${race.venue}${race.race_no}R ${race.type}：${top3}${race.winning_technique ? `。決まり手 ${race.winning_technique}` : ""}${race.trifecta ? `。3連単 ${race.trifecta} ${formatYen(race.trifecta_payout)}` : ""}`);
    lines.push(`- 出場選手：${race.entrants.map((x) => `${x.boat_no} ${x.racer_name}`).join(" / ")}`);
  }

  lines.push("");
  lines.push("## BoatStrikers DATA LAB");
  lines.push(`この日の全${raceCount}Rを集計すると、万舟率は${dataLab.manshu_rate}%でした。場別の万舟本数や1着艇番の分布は翌朝のDATA LAB素材として保存しています。`);

  return {
    title: `【${dateText}】ボートレース結果まとめ｜万舟・事故・優勝戦` ,
    headline: `${dateText}結果｜万舟${manshu.length}本${max ? `・最高${formatYen(max.payout)}` : ""}`,
    summary: max
      ? `${dateText}は${venueCount}場${raceCount}Rを集計。万舟${manshu.length}本、最高配当は${max.venue}${max.race_no}Rの${formatYen(max.payout)}。事故・異常着と優勝戦/ドリーム戦もまとめました。`
      : `${dateText}の${venueCount}場${raceCount}Rを集計。事故・異常着と優勝戦/ドリーム戦をまとめました。`,
    body: lines.join("\n"),
  };
}

function buildXPost({ raceDate, venueCount, raceCount, manshu, incidents, featured }) {
  const dateText = displayDate(raceDate).replace("月", "/").replace("日", "");
  const max = manshu[0];
  const winners = featured.filter((x) => x.type === "優勝戦" && x.winner).map((x) => `${x.venue}=${x.winner.racer_name}`).slice(0, 3);
  const parts = [
    `🚤 ${dateText} ボートレース結果`,
    `開催 ${venueCount}場 / ${raceCount}R`,
    `💰万舟 ${manshu.length}本${max ? `｜最高 ${max.venue}${max.race_no}R ${max.trifecta} ${formatYen(max.payout)}` : ""}`,
    `⚠️事故・異常着 ${incidents.length}R`,
  ];
  if (winners.length) parts.push(`🏆優勝 ${winners.join(" / ")}`);
  parts.push("詳しくはBoatStrikers NEWS「今日の結果」で。", "#ボートレース #BoatStrikers");
  return parts.join("\n");
}

export async function generateDailyResultDigest({ date } = {}) {
  const client = getClient();
  const raceDate = normalizeDate(date || jstYesterday());

  const [{ data: events, error: eventError }, { data: entries, error: entryError }] = await Promise.all([
    client.from("bs_race_events")
      .select("course_code,course_name,race_no,race_name,race_kind_code,trifecta,trifecta_payout,winning_technique_code,result_available")
      .eq("race_date", raceDate)
      .eq("result_available", true)
      .order("course_code").order("race_no"),
    client.from("bs_race_entries")
      .select("course_code,race_no,boat_no,racer_name,arrival_order,result_code,result_note")
      .eq("race_date", raceDate)
      .order("course_code").order("race_no").order("boat_no"),
  ]);
  if (eventError) throw eventError;
  if (entryError) throw entryError;
  if (!events?.length) throw new Error(`${raceDate} の確定結果がありません。`);

  const entriesByRace = groupEntries(entries || []);
  const venues = new Set(events.map((x) => x.course_code));
  const manshu = events
    .filter((x) => Number(x.trifecta_payout || 0) >= 10000)
    .map((x) => ({
      course_code: x.course_code,
      venue: x.course_name || `場コード${x.course_code}`,
      race_no: x.race_no,
      trifecta: trifectaText(x.trifecta),
      payout: Number(x.trifecta_payout),
    }))
    .sort((a, b) => b.payout - a.payout || a.course_code - b.course_code || a.race_no - b.race_no);

  const incidentMap = new Map();
  for (const row of entries || []) {
    const code = String(row.result_code || "").trim().toUpperCase();
    if (!RESULT_CODE_LABELS[code]) continue;
    const key = `${row.course_code}-${row.race_no}`;
    const event = events.find((x) => x.course_code === row.course_code && x.race_no === row.race_no);
    if (!incidentMap.has(key)) incidentMap.set(key, {
      course_code: row.course_code,
      venue: event?.course_name || `場コード${row.course_code}`,
      race_no: row.race_no,
      items: [],
    });
    incidentMap.get(key).items.push({
      boat_no: row.boat_no,
      racer_name: cleanName(row.racer_name),
      code,
      label: RESULT_CODE_LABELS[code],
    });
  }
  const incidents = [...incidentMap.values()].sort((a, b) => a.course_code - b.course_code || a.race_no - b.race_no);

  const featured = events
    .filter((x) => isFinalRace(x) || isDreamRace(x))
    .map((x) => makeFeaturedRace(x, entriesByRace.get(`${x.course_code}-${x.race_no}`) || []));

  const winnerEntries = (entries || []).filter((x) => x.arrival_order === 1);
  const boatWinCounts = Object.fromEntries([1,2,3,4,5,6].map((n) => [n, winnerEntries.filter((x) => x.boat_no === n).length]));
  const escapeWins = events.filter((x) => String(x.winning_technique_code || "") === "2").length;
  const dataLab = {
    race_date: raceDate,
    race_count: events.length,
    venue_count: venues.size,
    manshu_count: manshu.length,
    manshu_rate: Number(((manshu.length / events.length) * 100).toFixed(2)),
    max_payout: manshu[0]?.payout || null,
    max_payout_race: manshu[0] || null,
    incident_race_count: incidents.length,
    final_count: featured.filter((x) => x.type === "優勝戦").length,
    dream_count: featured.filter((x) => x.type === "ドリーム戦").length,
    boat1_wins: boatWinCounts[1],
    boat5_wins: boatWinCounts[5],
    boat_win_counts: boatWinCounts,
    escape_wins: escapeWins,
  };

  const article = buildArticle({ raceDate, raceCount: events.length, venueCount: venues.size, manshu, incidents, featured, dataLab });
  const xPost = buildXPost({ raceDate, venueCount: venues.size, raceCount: events.length, manshu, incidents, featured });
  const sourceUrl = `https://www.boatrace.jp/owpc/pc/race/pay?hd=${raceDate.replaceAll("-", "")}`;
  const sourceKey = `bs-daily-result-${raceDate}`;
  const now = new Date().toISOString();

  const { data: news, error: newsError } = await client.from("hatsune_news").upsert({
    source_key: sourceKey,
    title: article.title,
    list_headline: article.headline,
    summary: article.summary,
    article_body: article.body,
    article_body_source: "bs_data_template",
    category: "result",
    source_type: "bs_data",
    source_name: "BoatStrikers DATA LAB / BOAT RACE公式結果",
    source_url: sourceUrl,
    place: null,
    published_at: now,
    collected_at: now,
    is_featured: manshu[0]?.payout >= 50000 || featured.some((x) => x.type === "優勝戦"),
    priority: manshu[0]?.payout >= 50000 ? 8 : 6,
    is_published: true,
    updated_at: now,
  }, { onConflict: "source_key" }).select("id").single();
  if (newsError) throw newsError;

  const digestRow = {
    race_date: raceDate,
    status: "complete",
    race_count: events.length,
    venue_count: venues.size,
    manshu_count: manshu.length,
    max_payout: manshu[0]?.payout || null,
    manshu,
    incidents,
    featured_races: featured,
    data_lab: dataLab,
    article_title: article.title,
    article_body: article.body,
    x_post_text: xPost,
    source_url: sourceUrl,
    news_id: news.id,
    generated_at: now,
    updated_at: now,
  };
  const { error: digestError } = await client.from("bs_daily_result_digests").upsert(digestRow, { onConflict: "race_date" });
  if (digestError) throw digestError;

  await client.from("bs_news_sync_logs").insert({
    run_type: "daily_result_digest",
    source: "bs_race_events+bs_race_entries",
    found_count: events.length,
    verified_count: events.length,
    x_generated_count: 1,
    error_count: 0,
    details: { race_date: raceDate, manshu_count: manshu.length, incident_races: incidents.length, featured_races: featured.length, news_id: news.id },
  });

  return { ok: true, raceDate, newsId: news.id, article, xPost, manshu, incidents, featured, dataLab };
}
