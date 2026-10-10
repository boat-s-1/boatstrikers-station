import { articlePlan } from "./articlePlan.mjs";
import { claimsIn, norm } from "./claims.mjs";
import { courseReadings, dialogueContext, rateStatements, statementSourceIds } from "./dataReadings.mjs";

// A reviewer's guide to an AI draft's quality: six axes scored 1〜5 from the live check results and the article
// itself. It is reference information only. Approval still depends on the blocking checks alone, and no score ever
// approves or publishes anything.

// comparison_unclear is a review note: it lowers accuracy to 4, it never blocks.
const ACCURACY = ["unsupported_number", "unsupported_date", "source_mismatch", "period_mismatch", "heading_unsupported",
  "comparison_mismatch", "table_mismatch", "course_frame_confusion", "banned_phrase", "unknown_url"];
const SOURCES = ["missing_source", "unknown_source", "unregistered_source", "no_sources"];
// A dialogue restating the body is counted once, under the characters (it used to cost a point here as well).
const DUPLICATION = ["repeated_content", "repeated_fact", "repeated_caveat", "caveat_misplaced", "repeated_reading",
  "summary_restates", "takeaways_restate", "rate_numbers_repeated", "table_restated"];
const CHARACTER = ["dialogue_restates", "dialogue_echo", "character_role", "cast_mismatch", "too_many_dialogues", "persona_phrase"];
// blog-ai-v7: how the article opens and closes (checked for packs from version 3 on).
const FRAMING = ["lead_missing", "lead_without_hook", "lead_repeats_title", "frame_course_unexplained", "data_check_without_reason", "summary_without_finding", "summary_repeats_definition"];
// The six axes kept since PHASE 4.2, so averages stay comparable with earlier drafts.
const CLASSIC = new Set(["accuracy", "sources", "duplication", "explanation", "characters", "readability"]);
const READABILITY = ["too_long_for_facts", "low_information", "stock_phrase", "empty_data_check", "data_check_overlap", "long_title", "seo_description_length"];
const LABELS = {
  unsupported_number: "出典にない数値", unsupported_date: "出典にない日付", source_mismatch: "出典の取り違え", period_mismatch: "集計期間の不一致",
  heading_unsupported: "見出しの数値の裏付けなし", comparison_mismatch: "比較の誤り", table_mismatch: "表の数値の誤り", course_frame_confusion: "コースと枠番の混同",
  banned_phrase: "使用できない表現", unknown_url: "出典にないURL", causal_claim: "データにない因果関係",
  missing_source: "出典なしの数値・日付", unknown_source: "未登録の出典ID", unregistered_source: "未登録の出典URL", no_sources: "出典欄なし",
  statement_without_source: "出典なしの比較・事実", source_without_fetch_time: "取得日時のない収録データ",
  repeated_content: "同じ文の繰り返し", repeated_fact: "同じ事実の繰り返し", repeated_caveat: "注意書きの重複", caveat_misplaced: "注意書きの置き場所",
  repeated_reading: "同じ特徴の繰り返し", summary_restates: "まとめが本文の言い直し", takeaways_restate: "冒頭に数字・比較", rate_numbers_repeated: "表の数字を本文で再掲",
  dialogue_restates: "会話が本文の言い換え", character_role: "キャラクターの役割", cast_mismatch: "テーマ外のキャラクター", too_many_dialogues: "会話が多すぎる",
  persona_phrase: "口調ルール外の表現", unsourced_claim: "出典のない一般論", dialogue_echo: "会話の言い直し",
  lead_missing: "導入文なし", lead_without_hook: "導入に問いや発見がない", lead_repeats_title: "導入がタイトルと同じ発見", frame_course_unexplained: "号艇とコースの説明なし",
  data_check_without_reason: "DATA CHECKに理由なし", summary_without_finding: "まとめに発見なし", summary_repeats_definition: "まとめが定義の言い直し", comparison_unclear: "要確認の比較", table_restated: "表の並びを本文で再掲", data_check_overlap: "DATA CHECKの項目の重なり", dialogue_missing: "会話なし（推奨あり）", numbers_without_reading: "数字だけで特徴の説明なし",
  unexplained_data: "数字の意味の説明なし", too_long_for_facts: "情報量に対して長い", low_information: "情報のない文", stock_phrase: "決まり文句",
  empty_data_check: "中身のないDATA CHECK", long_title: "長いタイトル", seo_description_length: "SEO説明文の長さ",
};
const EXPLAINS_RATE = /(割合|そのコースから|進入した(コース|艇)|1着になった|1着を取った)/;

const clamp = n => Math.max(1, Math.min(5, Math.round(n)));
function blockTexts(b) {
  if (b.type === "DIALOGUE_SCENE") return (b.data.turns || []).map(t => t.text);
  if (b.type === "LIST") return b.data.items || [];
  if (b.type === "TABLE") return [b.data.caption, ...(b.data.rows || []).flat()].filter(Boolean);
  return [b.data?.text ?? ""];
}

export function scorecard({ document, pack, issues = [] }) {
  const count = new Map();
  for (const i of issues) count.set(i.code, (count.get(i.code) || 0) + 1);
  const found = codes => codes.filter(c => count.has(c));
  const named = codes => found(codes).map(c => `${LABELS[c] ?? c}${count.get(c) > 1 ? `×${count.get(c)}` : ""}`);
  const blocks = document.blocks.filter(b => !b.data?.system && b.type !== "HEADING");
  const plan = articlePlan(pack);
  const axes = [];
  const axis = (key, label, score, notes) => axes.push({ key, label, score, notes: notes.filter(Boolean) });

  // Accuracy: any wrong figure, date, comparison or table cell is decisive.
  const wrong = found(ACCURACY).filter(c => issues.some(i => i.code === c && i.level === "blocking"));
  const doubtful = named(["causal_claim", "comparison_unclear", "unsourced_claim"]);
  axis("accuracy", "事実の正確性", wrong.length ? 1 : doubtful.length ? 4 : 5,
    wrong.length ? named(wrong) : doubtful.length ? doubtful : ["数値・日付・比較はすべて出典と一致"]);

  // Sources: the share of blocks stating data (numbers, comparisons, facts) that carry a citation.
  const stating = blocks.filter(b => blockTexts(b).some(t => claimsIn(t).length || statementSourceIds(t, pack).length));
  const cited = stating.filter(b => b.data?.source_url).length;
  const share = stating.length ? cited / stating.length : 1;
  const sourceIssues = found(SOURCES);
  axis("sources", "出典の適切さ", sourceIssues.length ? Math.min(2, clamp(1 + 4 * share)) : clamp(1 + 4 * share),
    [`データを書いたブロック ${stating.length}個のうち出典あり ${cited}個`, ...named([...SOURCES, "statement_without_source"]),
      count.has("source_without_fetch_time") ? `${LABELS.source_without_fetch_time}を使用（公開前に確認）` : null]);

  // Duplication: each kind of repetition costs a point.
  const repeats = DUPLICATION.reduce((n, c) => n + (count.get(c) || 0), 0);
  axis("duplication", "重複の少なさ", clamp(5 - repeats), repeats ? named(DUPLICATION) : ["同じ内容の繰り返しなし"]);

  // Explaining the numbers: what the rate means, the figures, and the readings worth telling.
  const rateFacts = (pack.facts || []).some(f => /コース1着率$/.test(f.label));
  if (!rateFacts) axis("explanation", "数字の解説", null, ["コース別1着率を扱わない記事（対象外）"]);
  else {
    const text = norm(blocks.flatMap(blockTexts).join("\n"));
    const featured = courseReadings(pack.facts).filter(r => r.featured);
    const told = new Set(blocks.flatMap(b => blockTexts(b).flatMap(t => rateStatements(t, pack.facts, dialogueContext(b)).map(s => s.key))));
    const used = featured.filter(r => told.has(r.key));
    const hasTable = document.blocks.some(b => b.type === "TABLE");
    let score = 1 + (EXPLAINS_RATE.test(text) ? 1 : 0) + (hasTable ? 1 : 0) + (featured.length ? Math.round((2 * used.length) / featured.length) : 2);
    if (count.has("numbers_without_reading")) score = Math.min(score, 2);
    if (count.has("unexplained_data")) score -= 1;
    axis("explanation", "数字の解説", clamp(score), [
      EXPLAINS_RATE.test(text) ? "1着率の意味を説明" : "1着率の意味の説明なし",
      hasTable ? "表あり" : "表なし",
      featured.length ? `注目したい特徴 ${featured.length}個のうち本文で説明 ${used.length}個${used.length < featured.length ? `（未使用：${featured.filter(r => !told.has(r.key)).map(r => r.text).join("／")}）` : ""}` : null,
      ...named(["numbers_without_reading", "unexplained_data"]),
    ]);
  }

  // Characters: a dialogue where it helps, each character doing their part; none in a short article.
  const dialogues = document.blocks.filter(b => b.type === "DIALOGUE_SCENE").length;
  const characterIssues = CHARACTER.reduce((n, c) => n + (count.get(c) || 0), 0);
  if (!plan.maxDialogues && !dialogues) axis("characters", "キャラクターの自然さ", 5, ["短い記事なので会話なし（適切）"]);
  else if (!dialogues) axis("characters", "キャラクターの自然さ", count.has("dialogue_missing") ? 3 : 4, [count.has("dialogue_missing") ? named(["dialogue_missing"])[0] : "会話なし"]);
  else {
    // A dialogue that only confirms readings the body already gave adds little, though it is not wrong.
    const keys = include => new Set(document.blocks.filter(include).flatMap(b => blockTexts(b).flatMap(t => rateStatements(t, pack.facts, dialogueContext(b)).map(s => s.key))));
    // The summary recaps what was found (the dialogue's find included), so it is not the body the dialogue repeats.
    const inDialogue = keys(b => b.type === "DIALOGUE_SCENE"), inBody = keys(b => b.type !== "DIALOGUE_SCENE" && b.type !== "HEADING" && b.data?.placement !== "summary");
    const onlyRepeats = inDialogue.size > 0 && [...inDialogue].every(k => inBody.has(k));
    axis("characters", "キャラクターの自然さ", Math.min(clamp(5 - characterIssues), onlyRepeats ? 4 : 5),
      [...(characterIssues ? named(CHARACTER) : [`会話${dialogues}個・役割どおり`]), onlyRepeats ? "会話は本文と同じ特徴の確認にとどまっている" : null]);
  }

  // Readability: length for the information, filler, empty items.
  const readability = READABILITY.reduce((n, c) => n + (count.get(c) || 0), 0);
  axis("readability", "記事全体の読みやすさ", clamp(5 - readability), readability ? named(READABILITY) : ["分量・構成に指摘なし"]);

  // Opening and closing (7th axis, blog-ai-v7): the lead, the 号艇/course explanation, DATA CHECK reasons, the summary.
  if ((pack.version ?? 0) < 3) axis("framing", "導入とまとめ", null, ["blog-ai-v7より前の記事（対象外）"]);
  else {
    const framing = FRAMING.reduce((n, c) => n + (count.get(c) || 0), 0);
    axis("framing", "導入とまとめ", clamp(5 - framing), framing ? named(FRAMING) : ["導入の問い・用語の説明・確認の理由・まとめの発見がそろっている"]);
  }

  const mean = list => { const scored = list.filter(a => a.score !== null); return scored.length ? Math.round((10 * scored.reduce((n, a) => n + a.score, 0)) / scored.length) / 10 : null; };
  // average: the six classic axes (comparable with earlier drafts); average_all: every axis that applies.
  return { reference_only: true, axes, average: mean(axes.filter(a => CLASSIC.has(a.key))), average_all: mean(axes) };
}
