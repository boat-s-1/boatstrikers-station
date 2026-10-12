// 新旧記事の比較 Preview（管理者限定）で使う表示データの組み立て（純粋関数）。
// 既存記事・既存の NEWS 画面には何も反映しない。

import { NEWS_CHARACTERS, isWomenNews, newsHeadline } from "../newsTaxonomy.js";
import { formatMonthDay, formatSt } from "./dataCheck.js";

export const PREVIEW_STATUS_LABELS = {
  ready: { label: "採用可", tone: "ok", note: "品質チェックを通過し、DB との不一致もない" },
  needs_review: { label: "要確認", tone: "warn", note: "品質エラー、または記事と DB の不一致がある（自動では直さない）" },
  insufficient: { label: "材料不足", tone: "muted", note: "確認できる事実が足りず、試作本文を作らない" },
};

// 材料不足の記事の表示案（比較用。自動で非公開にはしない）。
export const INSUFFICIENT_OPTIONS = [
  { key: "A", title: "出典リンク＋確認済みの事実のみ", note: "試作で確認できた事実（あれば）と出典へのリンクだけを表示する。定型文は出さない。" },
  { key: "B", title: "現在の本文を維持", note: "今の article_body をそのまま表示する（定型文・女子戦テンプレートの混入は残る）。" },
  { key: "C", title: "詳細ページへの公開導線を抑える", note: "一覧からは出典へ直接案内し、詳細ページへのリンクを出さない。詳細ページは残し、検索エンジンには載せない（noindex）想定。" },
];

const LEGACY_ISSUES = [
  [/要点をまとめます/, "旧テンプレートの定型文"],
  [/女子戦をチェックするうえで|女子ボートレース(?:関連|を追う)|女子選手による/, "女子戦テンプレート", (row) => !isWomenNews(row)],
  [/日刊スポーツ新聞社のニュースサイト|nikkansports/, "出典サイトの宣伝文"],
  [/…/, "途中で切れた文"],
  [/元記事の内容を転載せず|初音NEWS/, "収集時の定型文"],
  [/確認したい|明らかになっていない|確認できない/, "AIの埋め草（確認したい等）"],
  [/日刊スポーツが報じ|マクールが報じ|日刊スポーツで掲載|マクールで掲載/, "本文に出典名"],
];

export function detectLegacyBodyIssues(row) {
  const body = String(row?.article_body || "");
  return LEGACY_ISSUES.filter(([re, , when]) => re.test(body) && (!when || when(row))).map(([, label]) => label);
}

export function formatJst(value) {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "";
  return new Date(t + 9 * 3600000).toISOString().slice(0, 16).replace("T", " ");
}

function finishText(finish) {
  if (finish == null) return "—";
  return /^\d$/.test(finish) ? `${finish}着` : finish;
}

// 照合根拠：どの範囲を読み、どの行を使ったか。
function evidenceOf(draft, { request, loadError, raceDataMeta }) {
  const data = draft.dataCheck;
  return {
    request: request
      ? request.digestDate
        ? `bs_race_events：${request.digestDate} の全レース（日次まとめテーブルの決まり手・逃げ件数は使わない）`
        : `場コード ${request.courseCode}／${request.from} 〜 ${request.to}（公開日の6日前〜公開日）・公開時点で締切から20分以上たったレースのみ`
      : "照合範囲なし（場・日付を特定できない）",
    loadError,
    truncated: raceDataMeta?.truncated || [],
    skipped: draft.dataCheckSkipped,
    checks: data?.checks || [],
    series: (data?.series || []).map((e) => ({ date: formatMonthDay(e.date), race: `${e.raceNo}R`, boat: `${e.boat}号艇`, course: e.course ? `${e.course}コース` : "—", st: e.st != null ? formatSt(e.st) : "—", finish: finishText(e.finish) })),
    used: data?.used || null,
  };
}

export function buildPreviewModel(row, result) {
  const { draft } = result;
  const status = PREVIEW_STATUS_LABELS[draft.status] || PREVIEW_STATUS_LABELS.insufficient;
  const verifiedFacts = [
    ...(draft.newsFact?.lead ? [draft.newsFact.lead] : []),
    ...(draft.newsFact?.points || []).map((p) => `${p.label}：${p.value}`),
  ];
  return {
    article: {
      id: row.id,
      headline: newsHeadline(row),
      title: row.title,
      sourceName: row.source_name || "",
      sourceUrl: row.source_url || "",
      published: formatJst(row.published_at),
      bodySource: row.article_body_source || "",
      category: row.category || "",
      sourceType: row.source_type || "",
    },
    currentBody: String(row.article_body || ""),
    legacyIssues: detectLegacyBodyIssues(row),
    status: { key: draft.status, ...status },
    newsFact: draft.newsFact,
    dataCheck: draft.dataCheck,
    editorView: draft.editorView ? { ...draft.editorView, name: NEWS_CHARACTERS[draft.editorView.character]?.name || "" } : null,
    quality: draft.quality,
    evidence: evidenceOf(draft, result),
    text: draft.text,
    insufficientOptions:
      draft.status === "insufficient"
        ? {
            A: { facts: verifiedFacts, sourceName: row.source_name || "", sourceUrl: row.source_url || "" },
            B: { body: String(row.article_body || ""), issues: detectLegacyBodyIssues(row) },
            C: { headline: newsHeadline(row), sourceName: row.source_name || "", sourceUrl: row.source_url || "" },
          }
        : null,
  };
}

export function summarizePreviewList(models) {
  const counts = { ready: 0, needs_review: 0, insufficient: 0 };
  for (const m of models) counts[m.status.key] = (counts[m.status.key] || 0) + 1;
  return counts;
}
