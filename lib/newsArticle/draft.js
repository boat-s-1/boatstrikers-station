// NEWS 記事本文の試作（PHASE 1）。NEWS FACT・DATA CHECK・EDITOR'S VIEW を組み立て、品質チェックの結果と一緒に返す。
// 純粋関数：DB への書き込みはしない。既存記事（hatsune_news）や NEWS 画面からはまだ呼ばれていない。

import { NEWS_CHARACTERS } from "../newsTaxonomy.js";
import { buildDataCheck, normalizeRaceData } from "./dataCheck.js";
import { buildEditorView } from "./editorView.js";
import { buildNewsFact } from "./newsFacts.js";
import { checkNewsDraft } from "./qualityCheck.js";

export const NEWS_DRAFT_SECTIONS = {
  fact: "NEWS FACT",
  data: "DATA CHECK",
  view: "EDITOR'S VIEW",
};

function knownNamesFor(data) {
  return [...new Set(data.entries.map((e) => e.name).filter((name) => name.length >= 2))];
}

// 表示・比較用のプレーンテキスト。出典は本文に入れず、末尾の出典欄（sourceNote）として分ける。
export function renderNewsDraftText(draft) {
  const lines = [];
  if (draft.newsFact) {
    if (draft.newsFact.lead) lines.push(draft.newsFact.lead, "");
    if (draft.newsFact.points.length) {
      lines.push(`■ ${NEWS_DRAFT_SECTIONS.fact}`);
      for (const p of draft.newsFact.points) lines.push(`・${p.label}：${p.value}`);
      lines.push("");
    }
  }
  if (draft.dataCheck) {
    lines.push(`■ ${NEWS_DRAFT_SECTIONS.data}（BoatStrikers レースDB）`);
    for (const r of draft.dataCheck.rows) lines.push(`・${r.label}：${r.value}`);
    lines.push("");
  }
  if (draft.editorView) {
    lines.push(`■ ${NEWS_DRAFT_SECTIONS.view}（${NEWS_CHARACTERS[draft.editorView.character]?.name || ""}）`, draft.editorView.text, "");
  }
  return lines.join("\n").trim();
}

export function buildNewsArticleDraft(row, rawRaceData = {}) {
  const data = normalizeRaceData(rawRaceData);
  const { facts, section } = buildNewsFact(row, { knownNames: knownNamesFor(data) });
  const check = buildDataCheck(row, facts, data);
  // 結果記事の「確定した」はレースDBでしか確かめられないため、DB で結果を確認できない場合はリード文を出さない。
  if (["race_result", "final_result"].includes(facts.eventType) && check.status !== "linked" && section) section.lead = "";
  const dataCheck = check.status === "linked" ? check : null;
  const editorView = buildEditorView(row, facts, check);
  const draft = {
    id: row?.id ?? null,
    newsFact: section,
    dataCheck,
    dataCheckSkipped: dataCheck ? "" : check.reason || "",
    editorView,
    sourceNote: row?.source_name ? `出典：${row.source_name}` : "",
    facts,
  };
  draft.quality = checkNewsDraft(draft, row);
  const hasContent = !!(section?.lead || dataCheck);
  const mismatch = (dataCheck?.checks || []).some((c) => c.result === "不一致");
  draft.status = !hasContent ? "insufficient" : !draft.quality.ok || mismatch ? "needs_review" : "ready";
  draft.text = renderNewsDraftText(draft);
  return draft;
}
