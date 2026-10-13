// 締切前に作成された「○R の結果を更新」記事の訂正案（純粋関数）。DB には書き込まない。
// 方針：確定したレース結果だけで本文を作り直す。公開日時（published_at）と見出しは変更しない。
// 訂正日時と訂正理由を本文の先頭に明記し、訂正前の内容は監査用に別途保全する（docs/news-result-guard.md）。

import { checkRaceResultConfirmed, normalizeTrifecta } from "./raceResultGuard.js";

export const CORRECTION_REASON = "公開時点でレースの締切前だったにもかかわらず「結果が確定した」と掲載していたため";
const CORRECTED_AT_PLACEHOLDER = "［訂正日時：適用時に記入］";

function compactName(value) {
  return String(value || "").replace(/[\s　]+/g, "");
}

function isFemale(entry) {
  if (Number(entry?.sex) === 2 || Number(entry?.sex_code) === 2) return true;
  const value = `${entry?.gender || ""} ${entry?.gender_code || ""}`.toLowerCase();
  return value.includes("女") || value.includes("female") || /(^|\s)(2|f)(\s|$)/.test(value);
}

function formatJst(value) {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + 9 * 3600000);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function dateJa(date) {
  const [y, m, d] = String(date).slice(0, 10).split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

function formatSt(value) {
  const n = Number(value);
  return Number.isFinite(n) && value != null ? (n < 0 ? `F${Math.abs(n).toFixed(2).slice(1)}` : n.toFixed(2).replace(/^0/, "")) : "";
}

// article：hatsune_news の行、race / result / entries：DB の確定データ。correctedAt を省略すると訂正日時は差し込み用の文字になる。
export function buildResultCorrection({ article, race, result, entries, correctedAt = null, now = Date.now() }) {
  const issues = [];
  const key = { race_date: String(race?.date || race?.race_date || "").slice(0, 10), course_code: Number(race?.cc ?? race?.course_code), race_no: Number(race?.race_no) };
  const sourceKey = `bs:result:${key.race_date}:${key.course_code}:${key.race_no}`;
  if (article?.source_key !== sourceKey) issues.push("記事とレースの対応（source_key）が一致しない");

  const entryRows = (entries || []).map((e) => ({ ...key, boat_no: e.boat ?? e.boat_no, arrival_order: e.order ?? e.arrival_order }));
  const guard = checkRaceResultConfirmed({
    key,
    event: { ...key, closing_time: race?.closing_time, trifecta: race?.trifecta, trifecta_payout: race?.payout ?? race?.trifecta_payout, race_cancel_code: race?.cancel ?? race?.race_cancel_code },
    result: { ...key, result_status: result?.status ?? result?.result_status, race_status: result?.race_status, winning_trifecta: result?.trifecta ?? result?.winning_trifecta, trifecta_payout: result?.payout ?? result?.trifecta_payout },
    entries: entryRows,
    now,
  });
  if (!guard.ok) issues.push(...guard.reasons.map((r) => `確定結果の確認：${r}`));

  const placeName = race?.course_name || article?.place || "";
  const ordered = (entries || [])
    .filter((e) => Number.isInteger(Number(e.order ?? e.arrival_order)) && Number(e.order ?? e.arrival_order) >= 1)
    .sort((a, b) => Number(a.order ?? a.arrival_order) - Number(b.order ?? b.arrival_order));
  const allFemale = (entries || []).length === 6 && (entries || []).every(isFemale);
  const trifecta = normalizeTrifecta(race?.trifecta);
  const payout = Number(race?.payout ?? race?.trifecta_payout);
  const technique = String(result?.technique ?? result?.winning_technique ?? "").trim();
  const popularity = Number(race?.popularity ?? result?.popularity) || null;
  const winner = ordered[0];

  if (!guard.ok || issues.length) {
    return { id: article?.id ?? null, ok: false, issues, before: pickBefore(article), after: null };
  }

  const raceLabel = `${placeName}${key.race_no}R`;
  const womenText = allFemale ? "（出走6名がすべて女子選手のレース）" : "";
  const tri = trifecta.split("").join("-");
  const payoutText = `${payout.toLocaleString("ja-JP")}円`;
  const summary = `${dateJa(key.race_date)}の${raceLabel}${womenText}は、${winner.boat ?? winner.boat_no}号艇の${compactName(winner.name ?? winner.racer_name)}選手が1着。3連単${tri}（払戻${payoutText}）で確定しました。`;

  const lines = [
    `【訂正】${correctedAt ? formatJst(correctedAt) : CORRECTED_AT_PLACEHOLDER}`,
    `この記事は、${formatJst(article?.published_at)}の公開時点でレースの締切前だったにもかかわらず「結果が確定した」と掲載していました。確定したレース結果に基づいて本文を訂正しました。訂正前の内容は記録として保管しています。`,
    "",
    `${dateJa(key.race_date)} ${raceLabel}${womenText}の確定結果`,
    ...ordered.slice(0, 3).map((e) => {
      const course = e.course ?? e.actual_course;
      const st = formatSt(e.st ?? e.actual_start_timing);
      const detail = [course ? `${course}コース` : "", st ? `ST${st}` : ""].filter(Boolean).join("・");
      return `${e.order ?? e.arrival_order}着　${e.boat ?? e.boat_no}号艇　${compactName(e.name ?? e.racer_name)}${detail ? `（${detail}）` : ""}`;
    }),
    ...(technique ? [`決まり手　${technique}`] : []),
    `3連単　${tri}　払戻${payoutText}${popularity ? `（${popularity}番人気）` : ""}`,
    "",
    "出典：BoatStrikers レースDB（確定結果）",
  ];

  const after = {
    title: article?.title ?? "",
    summary,
    article_body: lines.join("\n"),
    article_body_source: "manual",
  };
  // 訂正後の本文が DB の確定値と一致しているかを最後に確認する。
  if (!after.article_body.includes(`3連単　${tri}`) || !after.article_body.includes(payoutText)) issues.push("訂正本文に確定値が入っていない");
  if (/結果が確定(?:した|しました)。/.test(after.summary) && !after.summary.includes(tri)) issues.push("訂正要約に3連単が無い");

  return {
    id: article?.id ?? null,
    ok: issues.length === 0,
    issues,
    published_at: article?.published_at ?? null, // 変更しない
    reason: CORRECTION_REASON,
    evidence: { ...key, closing_time: race?.closing_time, trifecta: tri, payout, technique: technique || null, popularity, all_female: allFemale, top3: ordered.slice(0, 3).map((e) => ({ order: e.order ?? e.arrival_order, boat: e.boat ?? e.boat_no, name: compactName(e.name ?? e.racer_name) })) },
    before: pickBefore(article),
    after,
  };
}

function pickBefore(article) {
  return {
    title: article?.title ?? "",
    list_headline: article?.list_headline ?? null,
    summary: article?.summary ?? "",
    article_body: article?.article_body ?? "",
    article_body_source: article?.article_body_source ?? null,
    article_ai_model: article?.article_ai_model ?? null,
    updated_at: article?.updated_at ?? null,
  };
}
