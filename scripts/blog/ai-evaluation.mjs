// Automatic part of the AI article evaluation sheet (docs/blog/AI-EVALUATION.md), computed locally from the fixed
// copies of the staging drafts in tests/blog (read-only copies; nothing is read from or written to a database).
//   node scripts/blog/ai-evaluation.mjs            → the comparison table in Markdown
//   node scripts/blog/ai-evaluation.mjs --json     → the same rows as JSON
// The human ratings and the editor's changes are filled in by hand in the docs.
import { validateAiDocument } from "../../lib/blog/ai/validate.mjs";
import { scorecard } from "../../lib/blog/ai/scorecard.mjs";
import { sourceIdNotes } from "../../lib/blog/ai/approval.mjs";
import { PERSONAS } from "../../lib/blog/ai/personas.mjs";
import { v4Pack, v4Document } from "../../tests/blog/_tokonameV4.mjs";
import { v5Pack, v5Document } from "../../tests/blog/_tokonameV5.mjs";
import { v6Pack, v6Document } from "../../tests/blog/_tokonameV6.mjs";
import { v7Pack, v7Document } from "../../tests/blog/_tokonameV7.mjs";
import { v8Pack, v8Document, generationValidation as v8Generation } from "../../tests/blog/_tokonameV8.mjs";
import { v9Pack, v9Document } from "../../tests/blog/_tokonameV9.mjs";
import { todaPack, todaDocument, todaGenerationValidation } from "../../tests/blog/_todaV10.mjs";
import { todaV11Pack, todaV11Document, todaV11GenerationValidation } from "../../tests/blog/_todaV11.mjs";

// generation: the notes recorded when the draft was made, where the fixture keeps them (null: not copied).
export const ARTICLES = [
  { name: "常滑 v4", prompt: "blog-ai-v4", document: v4Document, pack: v4Pack, generation: null },
  { name: "常滑 v5", prompt: "blog-ai-v5", document: v5Document, pack: v5Pack, generation: null },
  { name: "常滑 v6", prompt: "blog-ai-v6", document: v6Document, pack: v6Pack, generation: null },
  { name: "常滑 v7", prompt: "blog-ai-v7", document: v7Document, pack: v7Pack, generation: null },
  { name: "常滑 v8", prompt: "blog-ai-v8", document: v8Document, pack: v8Pack, generation: v8Generation },
  { name: "常滑 v9", prompt: "blog-ai-v9", document: v9Document, pack: v9Pack, generation: [
    { code: "auto_cited", level: "warning" }, { code: "auto_cited", level: "warning" }, { code: "comparison_draft", level: "blocking" }] },
  { name: "戸田 v10", prompt: "blog-ai-v10", document: todaDocument, pack: todaPack, generation: todaGenerationValidation },
  { name: "戸田 v11", prompt: "blog-ai-v11", document: todaV11Document, pack: todaV11Pack, generation: todaV11GenerationValidation },
];

const textOf = b => b.type === "DIALOGUE_SCENE" ? (b.data.turns || []).map(t => t.text).join("") : b.type === "LIST" ? (b.data.items || []).join("") : b.type === "TABLE" ? "" : b.data?.text ?? "";
const axis = (sc, key) => sc.axes.find(a => a.key === key);

export function evaluate({ name, prompt, document, pack, generation }) {
  const issues = validateAiDocument({ document, pack });
  const sc = scorecard({ document, pack, issues });
  const body = document.blocks.filter(b => !b.data?.system && b.type !== "HEADING");
  const text = body.map(textOf).join("");
  const sentences = body.flatMap(b => textOf(b).split(/[。！？]/)).map(s => s.trim()).filter(Boolean);
  const notes = c => (axis(sc, c)?.score === 5 ? [] : axis(sc, c)?.notes ?? []);
  const dialogues = document.blocks.filter(b => b.type === "DIALOGUE_SCENE");
  return {
    name, prompt,
    accuracy: axis(sc, "accuracy").score, blocking: issues.filter(i => i.level === "blocking" && i.code !== "comparison_draft").length,
    sources: axis(sc, "sources").score,
    source_id_errors: generation ? sourceIdNotes({ source_pack: pack, validation: generation }).length : null,
    auto_cited: generation ? generation.filter(i => i.code === "auto_cited").length : null,
    duplication: axis(sc, "duplication").score, duplication_notes: notes("duplication"),
    readability: axis(sc, "readability").score, characters_count: text.length, blocks: body.length,
    sentence_length: sentences.length ? Math.round(text.length / sentences.length) : 0,
    characters: axis(sc, "characters").score,
    cast: [...new Set(dialogues.flatMap(b => b.data.turns.map(t => PERSONAS[t.character]?.name ?? t.character)))].join("・") || "なし",
    framing: axis(sc, "framing").score,
    average: sc.average, average_all: sc.average_all,
  };
}

const cell = v => (v === null || v === undefined ? "—" : String(v));
export function markdown(rows = ARTICLES.map(evaluate)) {
  const head = ["記事", "正確性", "要修正", "出典", "出典IDの誤り（作成時）", "自動出典", "重複", "重複の指摘", "読みやすさ", "文字数", "ブロック", "平均文長", "キャラクター", "会話の登場人物", "導入とまとめ", "平均（6項目）", "全項目"];
  const lines = rows.map(r => [r.name, r.accuracy, r.blocking, r.sources, r.source_id_errors, r.auto_cited, r.duplication, r.duplication_notes.join("、") || "なし",
    r.readability, r.characters_count, r.blocks, r.sentence_length, r.characters, r.cast, r.framing, r.average, r.average_all].map(cell));
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...lines.map(l => `| ${l.join(" | ")} |`)].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = ARTICLES.map(evaluate);
  console.log(process.argv.includes("--json") ? JSON.stringify(rows, null, 2) : markdown(rows));
}
