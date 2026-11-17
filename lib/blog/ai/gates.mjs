import { recheckDataset, displayPeriod } from "./data/datasets.mjs";
import { articleText } from "./duplicates.mjs";
import { scorecard } from "./scorecard.mjs";
import { AI_CATEGORIES } from "./topics.mjs";

// Automatic quality gates (PHASE 1). Seven required gates, each PASS / RETRY / HOLD:
//   PASS  — nothing found that stops publication.
//   RETRY — fixable by generating again (wording, length, SEO fields, a phrase that must not be used).
//   HOLD  — must not be published automatically: wrong or unverifiable data, duplicates, rights, personal data.
// The overall verdict is HOLD if any gate holds, RETRY if any retries and attempts remain (at most 2 regenerations),
// otherwise PASS. A RETRY with no attempts left becomes HOLD. Quality scores are supporting signals only: they can
// turn a PASS into a RETRY, never a failed fact check into a PASS.

export const GATE_VERSION = "blog-gates-v1";
export const REQUIRED_GATES = ["data_integrity", "sources", "duplicates", "usefulness", "seo", "copyright", "safety"];
export const MAX_RETRIES = 2;
export const GATE_LABELS = {
  data_integrity: "データの整合性", sources: "出典の検証", duplicates: "既存記事との重複", usefulness: "文章の有用性",
  seo: "SEO", copyright: "著作権", safety: "公開安全性",
};

// Validation codes (validate.mjs and friends) by gate and verdict.
const DATA_HOLD = new Set(["unsupported_number", "unsupported_date", "source_mismatch", "period_mismatch", "heading_unsupported", "missing_source",
  "official_table_unreadable", "repository_data_conflict"]);
const SOURCE_HOLD = new Set(["unknown_source", "comparison_draft", "source_without_fetch_time", "official_refresh_failed", "official_documents_missing", "gourmet_information_not_found"]);
const SOURCE_RETRY = new Set(["unregistered_source", "unknown_url", "no_sources"]);
const SAFETY_RETRY = new Set(["banned_phrase"]);

// Wording that implies guaranteed hits or profit, beyond BANNED_PHRASES.
const MISLEADING = [/的中(確定|保証|間違い)/, /必ず(当|勝|的中|儲)/, /稼げ(る|ます)/, /回収率\s*\d+\s*%?\s*(保証|確定)/, /(買えば|買うだけで).{0,10}(勝|当|儲)/];
// Personal data and secrets that must never appear in an article.
const PERSONAL = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, "メールアドレス"],
  [/(?<!\d)0\d{1,4}-\d{1,4}-\d{3,4}(?!\d)/, "電話番号"],
  [/(sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|service_role|SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET)/, "秘密情報らしき文字列"],
];
// A quotation attributed to a racer (real person). Characters' dialogue is fine; invented remarks of real people are not.
const ATTRIBUTED_QUOTE = /(選手|レーサー)(は|が|も)[^。「」]{0,20}「[^」]{2,}」[^。]{0,6}(と)?(語|話し|コメント|明か|述べ)/;
const VERBATIM_RUN = 40;
const COUNTED = /(\d[\d,]*(?:\.\d+)?)\s*(?:レース|件|%|％|円|倍)/g;
const normalizeNumber = v => { const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) ? String(n) : String(v); };
const periodNumbers = period => String(period).split(/[〜/]/).map(normalizeNumber);

// "2025/11/03〜2026/11/02" may be written as is or as "2025年11月3日〜2026年11月2日".
function periodForms(period) {
  const dates = String(period).split("〜").map(d => d.split("/").map(Number));
  const jp = dates.map(([y, m, d]) => `${y}年${m}月${d}日`).join("〜");
  return [normalize(period), normalize(jp)];
}

const gate = () => ({ verdict: "PASS", issues: [] });
function add(g, verdict, code, message) {
  g.issues.push({ verdict, code, message });
  if (verdict === "HOLD" || (verdict === "RETRY" && g.verdict === "PASS")) g.verdict = verdict === "HOLD" ? "HOLD" : "RETRY";
}
const note = (g, code, message) => g.issues.push({ verdict: "NOTE", code, message });

const normalize = t => String(t || "").normalize("NFKC").replace(/\s+/g, "");
function longestCommonRun(a, b) {
  // Rolling check of fixed-length runs: is any VERBATIM_RUN-character run of a also in b?
  if (a.length < VERBATIM_RUN || b.length < VERBATIM_RUN) return null;
  const runs = new Set();
  for (let i = 0; i + VERBATIM_RUN <= b.length; i++) runs.add(b.slice(i, i + VERBATIM_RUN));
  for (let i = 0; i + VERBATIM_RUN <= a.length; i++) if (runs.has(a.slice(i, i + VERBATIM_RUN))) return a.slice(i, i + VERBATIM_RUN);
  return null;
}

// document, pack: the draft and its source pack. validation: validateAiDocument() issues for this version.
// datasets: [{ stored, recomputed }] for research articles (recomputed now from the database).
// duplicates: duplicateFindings() result. attempt: regenerations already made (0 for the first draft).
export function runQualityGates({ document, pack, validation = [], datasets = [], duplicates = [], attempt = 0, maxRetries = MAX_RETRIES }) {
  const g = Object.fromEntries(REQUIRED_GATES.map(k => [k, gate()]));
  const codes = issue => issue.code;
  const text = articleText(document);
  const research = Boolean(AI_CATEGORIES[pack?.topic?.category_slug]?.research);

  // 1. Data integrity: every number traced to a source; research data re-verified against the database now.
  for (const i of validation) if (DATA_HOLD.has(codes(i))) add(g.data_integrity, "HOLD", i.code, i.message);
  const packDatasets = (pack?.sources || []).filter(s => s.kind === "boatstrikers_dataset");
  if (research && !packDatasets.length) add(g.data_integrity, "HOLD", "dataset_missing", "研究記事なのに、確定データの集計が出典にありません。");
  // Research articles: every counted figure (races, cases, %, yen, times) must be one of the dataset's values. The general
  // check treats "1–12 + レース" as a race number; in a research article "8レースに1回" is a derived figure and must not pass.
  if (packDatasets.length) {
    const allowed = new Set((pack.facts || []).map(f => normalizeNumber(f.value)));
    for (const s of packDatasets) for (const d of periodNumbers(s.period)) allowed.add(d);
    const seen = new Set();
    for (const m of normalize(text).matchAll(COUNTED)) {
      const value = normalizeNumber(m[1]);
      if (!allowed.has(value) && !seen.has(value)) { seen.add(value); add(g.data_integrity, "HOLD", "unsupported_count", `集計にない数値「${m[0]}」があります（集計値から計算した数値も使えません）。`); }
    }
  }
  for (const s of packDatasets) {
    const pair = datasets.find(d => d.stored?.definition === s.dataset && d.stored?.hash === s.dataset_hash);
    const check = recheckDataset({ stored: pair?.stored, recomputed: pair?.recomputed });
    if (!check.ok) add(g.data_integrity, "HOLD", check.code, `集計「${s.label}」をデータベースで再確認できませんでした（${check.code}）。`);
    else if (pair.stored.status !== "ok") add(g.data_integrity, "HOLD", "dataset_not_ok", `集計「${s.label}」が品質基準を満たしていません。`);
  }

  // 2. Sources.
  for (const i of validation) {
    if (SOURCE_HOLD.has(codes(i))) add(g.sources, "HOLD", i.code, i.message);
    else if (SOURCE_RETRY.has(codes(i))) add(g.sources, "RETRY", i.code, i.message);
  }
  if (!(pack?.sources || []).length) add(g.sources, "HOLD", "no_registered_sources", "出典が登録されていません。");
  for (const s of pack?.sources || []) if (s.url && !/^(https:\/\/|\/)/.test(s.url)) add(g.sources, "HOLD", "insecure_source", `出典「${s.label}」のURLが https でも内部ページでもありません。`);

  // 3. Duplicates against past articles.
  for (const d of duplicates) {
    if (d.level === "hold") add(g.duplicates, "HOLD", d.code, d.message);
    else note(g.duplicates, d.code, d.message);
  }

  // 4. Usefulness: answers the theme with data, states period and sample size, enough substance.
  const score = scorecard({ document, pack: pack || {}, issues: validation });
  const weak = score.axes.filter(a => a.score !== null && a.score <= 2);
  if (score.average !== null && score.average < 4) add(g.usefulness, "RETRY", "low_quality_score", `採点表の平均が${score.average}で、基準の4に届きません（参考指標）。`);
  for (const a of weak) add(g.usefulness, "RETRY", "weak_axis", `「${a.label}」が${a.score}点です：${a.notes.join("／")}`);
  if (text.replace(/\s/g, "").length < 600) add(g.usefulness, "RETRY", "too_short", "本文が600文字未満で、読者の疑問に答えるには短すぎます。");
  for (const s of packDatasets) {
    if (!periodForms(s.period).some(f => normalize(text).includes(f))) add(g.usefulness, "RETRY", "period_not_stated", `本文に集計期間（${s.period}）が書かれていません。`);
    if (!text.includes(String(s.usable))) add(g.usefulness, "RETRY", "sample_not_stated", `本文に集計したレース数（${s.usable}）が書かれていません。`);
  }
  if (!document.blocks.some(b => b.type === "WARNING" || /(限界|注意|あくまで|示していない|分からない)/.test(b.data?.text || ""))) add(g.usefulness, "RETRY", "no_limitations", "分析の注意点・限界が書かれていません。");

  // 5. SEO and technical fields.
  const title = document.title || "", description = document.seo?.description || "";
  if (title.length < 15 || title.length > 60) add(g.seo, "RETRY", "title_length", `タイトルは15〜60文字にしてください（現在${title.length}文字）。`);
  if (description.length < 50 || description.length > 160) add(g.seo, "RETRY", "description_length", `SEO説明文は50〜160文字にしてください（現在${description.length}文字）。`);
  if (!document.excerpt) add(g.seo, "RETRY", "no_excerpt", "抜粋がありません。");
  if (document.noindex) add(g.seo, "HOLD", "noindex", "noindex が設定されています。自動公開の対象にしません。");
  if (!document.category_id) add(g.seo, "RETRY", "no_category", "カテゴリーがありません。");
  if (!(document.author_ids || []).length) add(g.seo, "RETRY", "no_author", "著者がありません。");
  if (!document.blocks.some(b => b.type === "HEADING")) add(g.seo, "RETRY", "no_heading", "見出しがありません。");
  if (!document.cover?.media_id) add(g.seo, "RETRY", "no_cover", "表紙画像がありません。");

  // 6. Copyright: no long verbatim copy of fetched pages; media only from BoatStrikers' own registry.
  const body = normalize(text);
  for (const d of pack?.documents || []) {
    const run = longestCommonRun(body, normalize(d.excerpt));
    if (run) add(g.copyright, "RETRY", "verbatim_copy", `取得した公式ページの文章を${VERBATIM_RUN}文字以上そのまま使っています：「${run.slice(0, 20)}…」`);
  }
  for (const b of document.blocks) {
    if (b.type === "IMAGE" && (!b.data?.media_id || /^https?:/.test(String(b.data?.src || b.data?.url || "")))) add(g.copyright, "HOLD", "external_image", "外部の画像、または登録されていない画像があります。");
    if (b.type === "YOUTUBE") add(g.copyright, "HOLD", "video_embed", "動画のリンク・埋め込みは、利用権を人が確認するまで自動公開しません。");
    if (b.type === "QUOTE" && !b.data?.source_url) add(g.copyright, "RETRY", "quote_without_source", "引用に出典がありません。");
  }

  // 7. Publication safety.
  for (const i of validation) if (SAFETY_RETRY.has(codes(i))) add(g.safety, "RETRY", i.code, i.message);
  for (const re of MISLEADING) if (re.test(text)) add(g.safety, "RETRY", "misleading_claim", `的中・利益を誤解させる表現があります（${re.source}）。`);
  for (const [re, label] of PERSONAL) if (re.test(text)) add(g.safety, "HOLD", "personal_or_secret", `${label}が含まれています。`);
  if (ATTRIBUTED_QUOTE.test(text)) add(g.safety, "HOLD", "attributed_quote", "選手の発言として引用された文があります。実在の人物の発言は自動公開しません。");

  const gates = Object.fromEntries(REQUIRED_GATES.map(k => [k, { label: GATE_LABELS[k], ...g[k] }]));
  const verdicts = REQUIRED_GATES.map(k => g[k].verdict);
  let verdict = verdicts.includes("HOLD") ? "HOLD" : verdicts.includes("RETRY") ? "RETRY" : "PASS";
  let reason = null;
  if (verdict === "RETRY" && attempt >= maxRetries) { verdict = "HOLD"; reason = "retry_exhausted"; }
  return { gate_version: GATE_VERSION, verdict, reason, attempt, gates, scorecard: { average: score.average, average_all: score.average_all },
    dataset_hashes: packDatasets.map(s => ({ definition: s.dataset, hash: s.dataset_hash })) };
}

export const canAutoPublish = result => result?.verdict === "PASS" && REQUIRED_GATES.every(k => result.gates?.[k]?.verdict === "PASS");
export { displayPeriod };
