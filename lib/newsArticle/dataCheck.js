// DATA CHECK：記事の選手名・開催場・日付を BoatStrikers のレースDBと照合し、一意に対応したデータだけを整理する（純粋関数）。
// DB への読み取りは raceDataLoader.js が行い、ここでは渡されたデータだけを使う。
// ・記事の公開時点で終わっていたレースだけを使う（公開後の結果を記事に混ぜない）。
// ・優勝戦は race_kind_code=0021（RACE 画面・日次まとめと同じ判定）、グレードは bs_grade_race_events で確認できた場合だけ書く。
// ・照合できない場合は欄ごと省略する（status: "none" と理由だけ返す）。

import { VENUES as VENUE_NAMES, VENUE_CODES, foldNameVariants } from "./sourceText.js";

const FINAL_KIND_CODE = "0021";
const RACE_DONE_MINUTES = 20; // 締切からこの時間が過ぎていれば結果が出ている扱い
const SERIES_WINDOW_DAYS = 6;
const FINISH_LABELS = { F: "F（フライング）", L: "L（出遅れ）", 転: "転覆", 落: "落水", 沈: "沈没", 妨: "妨害失格", 不: "不完走", エ: "エンスト", 欠: "欠場", 失: "失格" };
const GRADE_TOKENS = [["SG", /SG/], ["G1", /P?G1|周年/], ["G2", /G2/], ["G3", /G3|オールレディース|企業杯/]];

function compactName(value) {
  return String(value || "").replace(/[\s　]+/g, "");
}

function pick(row, ...keys) {
  for (const key of keys) if (row?.[key] != null && row[key] !== "") return row[key];
  return null;
}

function num(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// DB の行（列名の揺れを含む）を照合用の形にそろえる。
export function normalizeRaceData(raw = {}) {
  if (raw?.normalized) return raw;
  const entries = (raw.entries || []).map((row) => ({
    date: String(pick(row, "race_date") || "").slice(0, 10),
    cc: num(pick(row, "course_code")),
    raceNo: num(pick(row, "race_no")),
    boat: num(pick(row, "boat_no")),
    regNo: String(pick(row, "racer_registration_no") || ""),
    name: compactName(pick(row, "racer_name")),
    racerClass: String(pick(row, "racer_class", "class") || ""),
    motorNo: num(pick(row, "motor_no", "motor_number")),
    motorRate: num(pick(row, "motor_2_rate", "motor_top2_rate")),
    course: num(pick(row, "actual_course")),
    st: num(pick(row, "actual_start_timing", "actual_st")),
    finish: pick(row, "arrival_order", "finish_place") == null ? null : String(pick(row, "arrival_order", "finish_place")),
  }));
  const races = (raw.races || []).map((row) => ({
    date: String(pick(row, "race_date") || "").slice(0, 10),
    cc: num(pick(row, "course_code")),
    raceNo: num(pick(row, "race_no")),
    dayNo: num(pick(row, "race_day_no")),
    kind: pick(row, "race_kind_code") == null ? "" : String(pick(row, "race_kind_code")).padStart(4, "0"),
    raceName: String(pick(row, "race_name") || ""),
    closing: String(pick(row, "closing_time", "deadline_time") || "").slice(0, 5),
    technique: String(pick(row, "winning_technique") || ""),
    trifecta: String(pick(row, "winning_trifecta", "trifecta_result", "trifecta") || "").replace(/^(\d)(\d)(\d)$/, "$1-$2-$3"),
    payout: num(pick(row, "trifecta_payout")),
    popularity: num(pick(row, "trifecta_popularity")),
  }));
  const grades = (raw.grades || []).map((row) => ({ start: String(row.start_date).slice(0, 10), end: String(row.end_date).slice(0, 10), cc: num(row.course_code), grade: String(row.grade || ""), title: String(row.title || "") }));
  const digests = (raw.digests || []).map((row) => ({
    date: String(row.race_date).slice(0, 10),
    raceCount: num(row.race_count),
    venueCount: num(row.venue_count),
    manshuCount: num(row.manshu_count),
    maxPayout: num(row.max_payout),
    manshu: Array.isArray(row.manshu) ? row.manshu : [],
  }));
  // 日次まとめの照合用：その日の全レース（bs_race_events）。決まり手コードは読まない。
  const dailyEvents = (raw.dailyEvents || []).map((row) => ({
    date: String(pick(row, "race_date") || "").slice(0, 10),
    cc: num(pick(row, "course_code")),
    venue: String(pick(row, "course_name") || ""),
    raceNo: num(pick(row, "race_no")),
    closing: String(pick(row, "closing_time") || "").slice(0, 5),
    trifecta: String(pick(row, "trifecta") || "").replace(/[^1-6]/g, "").replace(/^(\d)(\d)(\d)$/, "$1-$2-$3"),
    payout: num(pick(row, "trifecta_payout")),
    cancelled: !!String(pick(row, "race_cancel_code") || "").trim(),
  }));
  return { normalized: true, entries, races, grades, digests, dailyEvents, meta: raw.meta || {} };
}

// ---- 日付 ----
function jst(value) {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + 9 * 3600000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function minutesOf(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function formatMonthDay(date) {
  const [, m, d] = String(date).split("-").map(Number);
  return `${m}/${d}`;
}

export function formatSt(value) {
  if (value == null) return "";
  return value < 0 ? `F${Math.abs(value).toFixed(2).slice(1)}` : value.toFixed(2).replace(/^0/, "");
}

function finishLabel(finish) {
  if (finish == null) return "—";
  return /^\d$/.test(finish) ? `${finish}着` : FINISH_LABELS[finish] || finish;
}

function yen(value) {
  return `${Number(value).toLocaleString("ja-JP")}円`;
}

function raceKey(date, cc, raceNo) {
  return `${date}|${cc}|${raceNo}`;
}

// 記事の公開時点で結果が出ていたレースか。
function raceDoneAt(race, published) {
  if (!published || !race) return false;
  if (race.date < published.date) return true;
  if (race.date > published.date) return false;
  const closing = minutesOf(race.closing);
  return closing != null && closing + RACE_DONE_MINUTES <= published.minutes;
}

function gradeFor(data, cc, date) {
  return data.grades.find((g) => g.cc === cc && g.start <= date && date <= g.end) || null;
}

function claimedGrade(text) {
  for (const [grade, re] of GRADE_TOKENS) if (re.test(text)) return grade;
  return "";
}

function check(item, claim, db, result) {
  return { item, claim, db, result };
}

// ---- 選手の今節成績 ----
function lastContiguousSeries(entries) {
  const dates = [...new Set(entries.map((e) => e.date))].sort();
  let start = dates.length - 1;
  while (start > 0 && addDays(dates[start - 1], 2) >= dates[start]) start -= 1;
  const keep = new Set(dates.slice(start));
  return entries.filter((e) => keep.has(e.date)).sort((a, b) => a.date.localeCompare(b.date) || a.raceNo - b.raceNo);
}

function seriesStats(series) {
  const finished = series.filter((e) => e.finish != null);
  const wins = finished.filter((e) => e.finish === "1").length;
  const top2 = finished.filter((e) => e.finish === "1" || e.finish === "2").length;
  const sts = series.map((e) => e.st).filter((v) => v != null && v >= 0);
  const course1 = series.filter((e) => e.course === 1 && e.finish != null);
  return {
    starts: finished.length,
    wins,
    top2,
    avgSt: sts.length ? Math.round((sts.reduce((a, b) => a + b, 0) / sts.length) * 100) / 100 : null,
    stCount: sts.length,
    course1Starts: course1.length,
    course1Wins: course1.filter((e) => e.finish === "1").length,
    finishes: series.map((e) => (/^\d$/.test(e.finish || "") ? e.finish : e.finish || "-")),
  };
}

function longestWinStreak(series) {
  let best = 0;
  let run = 0;
  for (const e of series) {
    run = e.finish === "1" ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function racerCheck(row, facts, data, published) {
  const venue = facts.venue;
  const cc = VENUE_CODES[venue];
  if (!facts.racer) return { status: "none", reason: "記事から選手名を特定できない" };
  if (!cc) return { status: "none", reason: "記事から開催場を特定できない" };
  const from = addDays(published.date, -SERIES_WINDOW_DAYS);
  const raceByKey = new Map(data.races.map((r) => [raceKey(r.date, r.cc, r.raceNo), r]));
  const pool = data.entries.filter((e) => e.cc === cc && e.date >= from && e.date <= published.date);
  const wanted = foldNameVariants(facts.racer.dbName || facts.racer.name);
  const named = pool.filter((e) => foldNameVariants(e.name) === wanted);
  const regNos = [...new Set(named.map((e) => e.regNo))];
  if (!regNos.length) return { status: "none", reason: `${venue}の${formatMonthDay(from)}〜${formatMonthDay(published.date)}の出走表に「${facts.racer.name}」が見つからない` };
  if (regNos.length > 1) return { status: "none", reason: `「${facts.racer.name}」に該当する選手が複数いる` };
  const known = named.filter((e) => raceDoneAt(raceByKey.get(raceKey(e.date, e.cc, e.raceNo)) || { date: e.date, closing: "" }, published));
  if (!known.length) return { status: "none", reason: "記事の公開時点で結果が出ていたレースがない" };
  const series = lastContiguousSeries(known);
  const stats = seriesStats(series);
  const first = series[0];
  const last = series[series.length - 1];
  const variant = first.name !== facts.racer.name ? `、DB表記「${first.name}」` : "";
  const checks = [check("選手", `${facts.racer.name}（${venue}）`, `登録${first.regNo}・${first.racerClass}（${venue} ${formatMonthDay(first.date)}〜出走${variant}）`, "一致")];

  // 記事が指すレース。R番号があればその番号の直近のレース、なければ優勝・事故記事のみ最終出走を対象にする。
  let target = null;
  if (facts.raceNo) {
    target = [...series].reverse().find((e) => e.raceNo === facts.raceNo) || null;
    checks.push(check("レース番号", `${facts.raceNo}R`, target ? `${formatMonthDay(target.date)} ${target.raceNo}Rに出走` : "今節の該当レースに出走記録なし", target ? "一致" : "不一致"));
  } else if (["win", "incident"].includes(facts.eventType)) {
    target = last;
  } else if (/^\d着$/.test(facts.result || "")) {
    // R番号の無い「白星」記事：最終出走日に記事と同じ着順のレースが1つだけなら、それを対象にする。
    const sameDay = series.filter((e) => e.date === last.date && e.finish === facts.result.replace("着", ""));
    if (sameDay.length === 1) target = sameDay[0];
  }
  const targetRace = target ? raceByKey.get(raceKey(target.date, target.cc, target.raceNo)) || null : null;

  if (target) {
    // 優勝戦の枠番（展望記事）はこれから走るレースの枠なので、既に終わったレースとは照合しない。
    if (facts.frame && facts.eventType !== "final") checks.push(check("枠番", `${facts.frame}枠`, `${target.boat}号艇`, target.boat === facts.frame ? "一致" : "不一致"));
    if (facts.course) checks.push(check("進入コース", `${facts.course}コース`, target.course ? `${target.course}コース` : "記録なし", target.course == null ? "未確認" : target.course === facts.course ? "一致" : "不一致"));
    if (facts.st != null) checks.push(check("ST", `コンマ${String(facts.st.toFixed(2)).slice(2)}`, target.st != null ? formatSt(target.st) : "記録なし", target.st == null ? "未確認" : Math.abs(target.st - facts.st) < 0.001 ? "一致" : "不一致"));
    if (facts.flying) checks.push(check("フライング", "フライング", finishLabel(target.finish), target.finish === "F" ? "一致" : "不一致"));
    if (facts.result) {
      const claimed = facts.result === "優勝" ? "1" : facts.result.replace("着", "");
      checks.push(check("着順", facts.result === "優勝" ? "優勝（1着）" : facts.result, finishLabel(target.finish), target.finish === claimed ? "一致" : "不一致"));
    }
    if (facts.kimarite && target.finish === "1" && /優勝|1着/.test(facts.result)) {
      const tech = targetRace?.technique || "";
      checks.push(check("決まり手", facts.kimarite, tech || "記録なし", !tech ? "未確認" : tech === facts.kimarite ? "一致" : "不一致"));
    }
    if (facts.stage === "優勝戦" && ["win", "incident", "final_result"].includes(facts.eventType)) {
      const isFinal = targetRace?.kind === FINAL_KIND_CODE || /優勝戦/.test(targetRace?.raceName || "");
      checks.push(check("優勝戦", "優勝戦", isFinal ? "優勝戦（レース種別）" : "レース種別では確認できない", isFinal ? "一致" : "未確認"));
    }
  }
  if (facts.streak && /\d連勝|連勝/.test(facts.streak)) {
    const n = Number((facts.streak.match(/(\d)連勝/) || [])[1] || 2);
    const best = longestWinStreak(series);
    checks.push(check("連勝", facts.streak, `今節の最多連続1着 ${best}`, best >= n ? "一致" : "不一致"));
  }
  const labelGrade = claimedGrade(`${facts.eventLabel}`);
  const dbGrade = gradeFor(data, cc, last.date);
  if (labelGrade) checks.push(check("グレード", labelGrade, dbGrade ? `${dbGrade.grade} ${dbGrade.title}` : "開催グレード表に登録なし", dbGrade ? (dbGrade.grade.replace("PG1", "G1") === labelGrade ? "一致" : "不一致") : "未確認"));

  const rows = [
    { label: "選手", value: `${first.name}（${first.racerClass}）` },
    { label: "今節", value: `${venue} ${first.date === last.date ? formatMonthDay(first.date) : `${formatMonthDay(first.date)}〜${formatMonthDay(last.date)}`}／${stats.starts}走${stats.wins}勝・2連対${stats.top2}回` },
    { label: "着順", value: stats.finishes.join(" ") },
  ];
  if (stats.avgSt != null) rows.push({ label: "平均ST", value: `${formatSt(stats.avgSt)}（${stats.stCount}走）` });
  if (stats.course1Starts) rows.push({ label: "1コース", value: `${stats.course1Starts}走${stats.course1Wins}勝` });
  if (last.motorNo) rows.push({ label: "モーター", value: `${last.motorNo}号機${last.motorRate != null ? `（2連率${last.motorRate}%）` : ""}` });
  if (target) {
    const parts = [`${target.boat}号艇`, target.course ? `${target.course}コース` : "", target.st != null ? `ST${formatSt(target.st)}` : "", finishLabel(target.finish)].filter(Boolean);
    rows.push({ label: `${formatMonthDay(target.date)} ${target.raceNo}R`, value: parts.join("・") });
    if (targetRace?.technique || targetRace?.payout) {
      rows.push({
        label: "レース結果",
        value: [targetRace.technique && `決まり手 ${targetRace.technique}`, targetRace.trifecta && targetRace.payout != null && `3連単 ${targetRace.trifecta} ${yen(targetRace.payout)}${targetRace.popularity ? `（${targetRace.popularity}番人気）` : ""}`].filter(Boolean).join("／"),
      });
    }
  }

  return {
    status: "linked",
    kind: "racer",
    rows,
    series: series.map((e) => ({ date: e.date, raceNo: e.raceNo, boat: e.boat, course: e.course, st: e.st, finish: e.finish })),
    checks,
    finalConfirmed: checks.some((c) => c.item === "優勝戦" && c.result === "一致"),
    gradeConfirmed: dbGrade ? dbGrade.grade : "",
    materials: { stats, target, targetRace, motor: last.motorNo ? { no: last.motorNo, rate: last.motorRate } : null },
    used: { entries: series.length, races: targetRace ? 1 : 0 },
  };
}

// ---- BS DATA：1レースの結果 ----
function raceResultCheck(facts, data, published) {
  const cc = VENUE_CODES[facts.venue];
  const date = facts.raceDate || published.date;
  if (!cc || !facts.raceNo) return { status: "none", reason: "記事から場・レース番号を特定できない" };
  const race = data.races.find((r) => r.date === date && r.cc === cc && r.raceNo === facts.raceNo);
  if (!race) return { status: "none", reason: "該当レースがレースDBにない" };
  if (!raceDoneAt(race, published)) return { status: "none", code: "race_not_finished", reason: `記事の公開時点（${String(published.minutes / 60 | 0).padStart(2, "0")}:${String(published.minutes % 60).padStart(2, "0")}）では締切前（${race.closing}締切）で、結果が出ていない` };
  const entrants = data.entries.filter((e) => e.date === date && e.cc === cc && e.raceNo === facts.raceNo);
  const order = entrants.filter((e) => /^\d$/.test(e.finish || "")).sort((a, b) => Number(a.finish) - Number(b.finish));
  const rows = [];
  if (race.technique) rows.push({ label: "決まり手", value: race.technique });
  if (race.trifecta && race.payout != null) rows.push({ label: "3連単", value: `${race.trifecta} ${yen(race.payout)}${race.popularity ? `（${race.popularity}番人気）` : ""}` });
  for (const e of order.slice(0, 3)) {
    rows.push({ label: `${e.finish}着`, value: `${e.boat}号艇 ${e.name}${e.course ? `（${e.course}コース` : "（"}${e.st != null ? `・ST${formatSt(e.st)}` : ""}）`.replace("（）", "") });
  }
  const others = entrants.filter((e) => e.finish && !/^\d$/.test(e.finish));
  for (const e of others) rows.push({ label: "その他", value: `${e.boat}号艇 ${e.name} ${finishLabel(e.finish)}` });
  const checks = [check("レース", `${formatMonthDay(date)} ${facts.venue}${facts.raceNo}R`, race.technique ? "結果あり" : "結果なし", race.technique ? "一致" : "未確認")];
  if (/女子戦/.test(facts.claimText || "")) checks.push(check("女子戦", "女子戦", race.raceName ? race.raceName : "レース名の登録なし", /女子|レディース|ヴィーナス/.test(race.raceName) ? "一致" : "未確認"));
  return {
    status: rows.length ? "linked" : "none",
    reason: rows.length ? "" : "結果の詳細がレースDBにない",
    kind: "race",
    rows,
    checks,
    finalConfirmed: race.kind === FINAL_KIND_CODE,
    gradeConfirmed: "",
    materials: { targetRace: race, order },
    used: { entries: entrants.length, races: 1 },
  };
}

// ---- BS DATA：日次まとめ ----
// 日次まとめは bs_race_events から公開時点で確定していたレースを数え直す。
// bs_daily_result_digests の決まり手・逃げ件数は結果テーブルと食い違うため使わない（docs/news-article-phase2a.md）。
function summarizeDailyEvents(events, published) {
  const done = events.filter((e) => !e.cancelled && /^\d-\d-\d$/.test(e.trifecta) && e.payout > 0 && raceDoneAt(e, published));
  const manshu = done
    .filter((e) => e.payout >= 10000)
    .map((e) => ({ venue: e.venue || VENUE_NAMES[e.cc - 1] || `場コード${e.cc}`, race_no: e.raceNo, trifecta: e.trifecta, payout: e.payout }))
    .sort((a, b) => b.payout - a.payout);
  return { date: done[0]?.date || "", raceCount: done.length, venueCount: new Set(done.map((e) => e.cc)).size, manshuCount: manshu.length, manshu, source: "bs_race_events" };
}

function digestCheck(facts, data, published) {
  const fromEvents = data.dailyEvents.filter((e) => e.date === facts.raceDate);
  const digest = fromEvents.length ? summarizeDailyEvents(fromEvents, published) : data.digests.find((d) => d.date === facts.raceDate);
  if (!digest || !digest.raceCount) return { status: "none", reason: "該当日の確定レースがない" };
  const top = [...digest.manshu].sort((a, b) => Number(b.payout) - Number(a.payout));
  const rows = [
    { label: "集計", value: `${digest.venueCount}場・${digest.raceCount}レース` },
    { label: "万舟", value: `${digest.manshuCount}本（万舟率${((digest.manshuCount / digest.raceCount) * 100).toFixed(1)}%）` },
  ];
  if (top[0]) rows.push({ label: "最高配当", value: `${top[0].venue}${top[0].race_no}R ${top[0].trifecta} ${yen(top[0].payout)}` });
  const over100k = top.filter((m) => Number(m.payout) >= 100000).length;
  if (over100k) rows.push({ label: "10万円超", value: `${over100k}本` });
  const d = facts.digest || {};
  const checks = [];
  if (d.manshuCount != null) checks.push(check("万舟本数", `${d.manshuCount}本`, `${digest.manshuCount}本`, d.manshuCount === digest.manshuCount ? "一致" : "不一致"));
  if (d.raceCount != null) checks.push(check("レース数", `${d.raceCount}レース`, `${digest.raceCount}レース`, d.raceCount === digest.raceCount ? "一致" : "不一致"));
  if (d.maxPayout) {
    const claimed = Number(String(d.maxPayout.text).replace(/,/g, "").replace(/(\d+)万(\d*)/, (m, x, y) => String(Number(x) * 10000 + Number(y || 0))));
    checks.push(check("最高配当", `${d.maxPayout.venue}${d.maxPayout.raceNo}R ${d.maxPayout.text}円`, top[0] ? `${top[0].venue}${top[0].race_no}R ${yen(top[0].payout)}` : "なし", top[0] && Number(top[0].payout) === claimed ? "一致" : "不一致"));
  }
  return { status: "linked", kind: "digest", rows, checks, finalConfirmed: false, gradeConfirmed: "", materials: { digest, top, over100k }, used: { [digest.source === "bs_race_events" ? "dailyEvents" : "digest"]: fromEvents.length || 1 } };
}

// ---- BS DATA：モーター ----
function motorCheck(facts, data, published) {
  const cc = VENUE_CODES[facts.venue];
  if (!cc || !facts.racer || !facts.motor) return { status: "none", reason: "記事から場・選手・モーターを特定できない" };
  const day = data.entries.filter((e) => e.cc === cc && e.date === published.date);
  const mine = day.filter((e) => foldNameVariants(e.name) === foldNameVariants(facts.racer.dbName || facts.racer.name));
  const regNos = [...new Set(mine.map((e) => e.regNo))];
  if (regNos.length !== 1) return { status: "none", reason: "公開日の出走表で選手を一意に特定できない" };
  const own = mine[0];
  const perRacer = new Map(day.map((e) => [e.regNo, e.motorRate]));
  const rates = [...perRacer.values()].filter((v) => v != null).sort((a, b) => b - a);
  const rank = rates.indexOf(own.motorRate) + 1;
  const rows = [
    { label: "選手", value: `${own.name}（${own.racerClass}）` },
    { label: "モーター", value: `${own.motorNo}号機・2連率${own.motorRate}%` },
  ];
  if (!facts.womenScope) rows.push({ label: "出場選手内", value: `${perRacer.size}人中${rank}位` });
  const checks = [
    check("号機", `${facts.motor.no}号機`, `${own.motorNo}号機`, own.motorNo === facts.motor.no ? "一致" : "不一致"),
    check("2連率", `${facts.motor.rate}%`, `${own.motorRate}%`, Math.abs(own.motorRate - facts.motor.rate) < 0.05 ? "一致" : "不一致"),
    // 「女子戦の出場選手で最も高い」は女子選手の中での順位。DB に性別が無いため、全出場選手の順位では判定しない。
    facts.womenScope
      ? check("順位", "女子選手の中で最も高い", `全出場選手${perRacer.size}人中${rank}位（性別データが無く女子内の順位は確認できない）`, "未確認")
      : check("順位", "最も高い", `${perRacer.size}人中${rank}位`, rank === 1 ? "一致" : "不一致"),
  ];
  return { status: "linked", kind: "motor", rows, checks, finalConfirmed: false, gradeConfirmed: "", materials: { motor: { no: own.motorNo, rate: own.motorRate, rank, field: perRacer.size } }, used: { entries: day.length } };
}

const RACE_TEXT_RE = /\d{1,2}R|コース|枠|着|勝|白星|V|優勝|優出|逃げ|まくり|差し|フライング|スタート|モーター|号機|機/;

export function buildDataCheck(row, facts, rawData) {
  const data = normalizeRaceData(rawData);
  const published = jst(row?.published_at);
  if (!published) return { status: "none", reason: "公開日時がない" };
  // 取得件数が上限に達した（途中までしか読めていない）場合は、照合結果が不完全になるため使わない。
  if (data.meta?.truncated?.length) return { status: "none", reason: `レースデータの取得が上限に達した（${data.meta.truncated.join("・")}）ため照合しない` };
  switch (facts.eventType) {
    case "digest":
      return digestCheck(facts, data, published);
    case "race_result":
    case "final_result":
      return raceResultCheck(facts, data, published);
    case "bs_motor":
      return motorCheck(facts, data, published);
    case "bs_tomorrow":
    case "bs_tomorrow_pending":
      return { status: "none", reason: "翌日の出走表は記事の公開時点のデータを再現できないため照合しない" };
    case "column":
      return { status: "none", reason: "レース成績に関する記事ではない" };
    default:
      if (!RACE_TEXT_RE.test(`${facts.headline}${facts.claimText || ""}`)) return { status: "none", reason: "レース成績に関する記述がない" };
      return racerCheck(row, facts, data, published);
  }
}


// 記事1件の照合に必要なレースデータの範囲（raceDataLoader.js に渡す）。場が分からない記事はレース単位のデータを読まない。
export function dataCheckRequest(row, facts) {
  const published = jst(row?.published_at);
  if (!published) return null;
  if (facts.eventType === "digest") return facts.raceDate ? { digestDate: facts.raceDate } : null;
  const courseCode = VENUE_CODES[facts.venue] || null;
  if (!courseCode) return null;
  return { courseCode, from: addDays(published.date, -SERIES_WINDOW_DAYS), to: published.date };
}
