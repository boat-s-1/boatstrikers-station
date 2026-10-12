// AI による事実抽出（PHASE 2A：設計と試験比較のみ。本番記事への生成・保存はしない）。
// ルールで事実を取り出せなかった記事について、AI に「入力のどの文のどの部分が根拠か」を必ず添えて事実を挙げさせ、
// validateAiFacts() で根拠の実在・数値・推測表現・丸写しを機械的に確かめて、通ったものだけを候補にする。
// モデル呼び出しは complete（プロンプトを受け取り文字列を返す関数）として外から渡す（この中では API を呼ばない）。

import { cleanSourceSummary, normalizeText, splitHeadline } from "./sourceText.js";
import { COPY_LIMIT, longestCommonSubstring } from "./qualityCheck.js";

export const AI_FACT_KINDS = ["result", "record", "race", "entry", "schedule", "quote", "other"];
const MAX_FACTS = 6;
const MAX_TEXT = 80;
const SPECULATION_RE = /期待|だろう|はずだ|見込|狙い目|有力|本命|注目したい|注目される|確認したい|明らかになっていない|見逃せない|かもしれない|可能性|予想/;
const SOURCE_NAME_RE = /日刊スポーツ|ニッカン|nikkansports|マクール(?!杯)|macour|https?:\/\//i;

// AI に渡す入力。見出し（H）と、掃除済みの要約の文（S1, S2, …）だけ。途中で切れた文・定型文は渡さない。
export function buildAiFactSegments(row) {
  const { main } = splitHeadline(row);
  const sentences = cleanSourceSummary(row?.summary).sentences;
  return [{ id: "H", text: main }, ...sentences.map((text, index) => ({ id: `S${index + 1}`, text: normalizeText(text) }))].filter((s) => s.text);
}

export const AI_FACT_SYSTEM_PROMPT = [
  "あなたはボートレースニュースの事実確認担当です。与えられた入力（見出し H と要約の文 S1, S2, …）に書かれている事実だけを取り出します。",
  "規則:",
  "1. 入力に書かれていないことは書かない。推測・補足・一般知識・予想・評価は書かない。",
  "2. 各事実に evidence を必ず付ける。evidence.segment は入力の id、evidence.quote はその文から一字一句そのまま抜き出した部分（10〜40字程度）。",
  "3. text は日本語の短い文（80字以内）。入力の文をそのまま写さず、主語・場所・数値を整理して書く。数値は evidence.quote にある数値だけを使う。",
  "4. 目標・展望（「〜を目指す」「〜へ」）は達成した事実として書かない。kind を schedule にし、目標であることを明記する。",
  "5. 選手の談話は kind=quote とし、text に「」付きで入力どおりに書く。",
  "6. 事実が無い場合は facts を空配列にする。",
  `7. 事実は最大${MAX_FACTS}件。kind は ${AI_FACT_KINDS.join(" / ")} のいずれか。`,
  '出力は JSON のみ: {"facts":[{"kind":"...","text":"...","evidence":[{"segment":"S1","quote":"..."}]}]}',
].join("\n");

export function buildAiFactPrompt(row) {
  const segments = buildAiFactSegments(row);
  const user = ["入力:", ...segments.map((s) => `${s.id}: ${s.text}`)].join("\n");
  return { system: AI_FACT_SYSTEM_PROMPT, user, segments };
}

function numbersIn(text) {
  return (normalizeText(text).replace(/,/g, "").match(/\d+/g) || []).map((n) => String(Number(n)));
}

function withoutQuotes(text) {
  return String(text || "").replace(/「[^」]*」/g, "");
}

export function parseAiFactOutput(raw) {
  const text = String(raw || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.facts) ? parsed.facts : null;
  } catch {
    return null;
  }
}

// 1件ずつ検証し、採用（accepted）と不採用（rejected＋理由）に分ける。
export function validateAiFacts(row, facts) {
  const segments = new Map(buildAiFactSegments(row).map((s) => [s.id, normalizeText(s.text)]));
  const allInput = [...segments.values()].join("\n");
  const accepted = [];
  const rejected = [];
  const seen = new Set();
  for (const fact of (Array.isArray(facts) ? facts : []).slice(0, MAX_FACTS * 2)) {
    const reasons = [];
    const text = normalizeText(fact?.text);
    const evidence = Array.isArray(fact?.evidence) ? fact.evidence : [];
    if (!AI_FACT_KINDS.includes(fact?.kind)) reasons.push(`kind が不正（${fact?.kind}）`);
    if (!text) reasons.push("text が空");
    if (text.length > MAX_TEXT) reasons.push(`text が${MAX_TEXT}字を超える`);
    if (!evidence.length) reasons.push("根拠（evidence）が無い");
    const quotes = [];
    for (const e of evidence) {
      const source = segments.get(e?.segment);
      const quote = normalizeText(e?.quote);
      if (!source) reasons.push(`根拠の入力 ${e?.segment} が存在しない`);
      else if (!quote || !source.includes(quote)) reasons.push(`根拠「${quote}」が ${e.segment} に一字一句一致しない`);
      else quotes.push(quote);
    }
    const quoteNumbers = new Set(numbersIn(quotes.join(" ")));
    const missing = numbersIn(text).filter((n) => !quoteNumbers.has(n));
    if (missing.length) reasons.push(`根拠に無い数値: ${[...new Set(missing)].join(", ")}`);
    if (SPECULATION_RE.test(withoutQuotes(text))) reasons.push(`推測・評価の表現（${withoutQuotes(text).match(SPECULATION_RE)[0]}）`);
    if (SOURCE_NAME_RE.test(text)) reasons.push("出典名・URL を含む");
    if (fact?.kind === "quote") {
      const inner = text.match(/「([^」]+)」/)?.[1] || "";
      if (!inner || !allInput.includes(inner)) reasons.push("談話が入力と一致しない");
    } else {
      const lcs = longestCommonSubstring(withoutQuotes(text), allInput);
      if (lcs.length > COPY_LIMIT) reasons.push(`入力と${lcs.length}字連続で一致（丸写し）`);
    }
    if (fact?.kind !== "schedule" && /目指|狙|へ$|に向け/.test(withoutQuotes(text))) reasons.push("目標・展望を schedule 以外で書いている");
    if (seen.has(text)) reasons.push("重複");
    seen.add(text);
    const item = { kind: fact?.kind, text, evidence: evidence.map((e) => ({ segment: e?.segment, quote: normalizeText(e?.quote) })) };
    if (reasons.length) rejected.push({ ...item, reasons });
    else accepted.push(item);
  }
  return { accepted: accepted.slice(0, MAX_FACTS), rejected };
}

// 試験用の実行口。complete は ({ system, user }) => Promise<string>。本番の記事には保存しない。
export async function runAiFactExtraction(row, complete) {
  const prompt = buildAiFactPrompt(row);
  if (!prompt.segments.length) return { prompt, raw: "", facts: null, accepted: [], rejected: [], error: "入力が無い" };
  const raw = await complete({ system: prompt.system, user: prompt.user });
  const facts = parseAiFactOutput(raw);
  if (!facts) return { prompt, raw, facts: null, accepted: [], rejected: [], error: "JSON として読めない" };
  return { prompt, raw, facts, ...validateAiFacts(row, facts), error: "" };
}
