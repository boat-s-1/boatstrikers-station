// 品質チェック：試作本文に、出典名・宣伝文・女子戦テンプレート・丸写し・根拠のない数値・予想・重複が入っていないかを調べる（純粋関数）。

import { isWomenNews } from "../newsTaxonomy.js";
import { cleanSourceSummary, isPromoText, normalizeText, splitHeadline, splitSentences } from "./sourceText.js";

const SOURCE_NAME_RE = /日刊スポーツ|ニッカンスポーツ|nikkansports|マクール(?!杯)|macour|BOAT RACE公式|boatrace\.jp|https?:\/\//i;
const WOMEN_RE = /女子|レディース|ヴィーナス|初音/;
const SPECULATION_RE = /期待|だろう|はずだ|見込|狙い目|有力|本命|注目したい|注目される|注目が集ま|確認したい|明らかになっていない|見逃せない|要点をまとめ|今後の|かもしれない|可能性|勝てる|勝ちそう|優勝候補/;
export const COPY_LIMIT = 25; // 出典と連続して一致してよい最大文字数（「」内の談話は除く）

function withoutQuotes(text) {
  return String(text || "").replace(/「[^」]*」|『[^』]*』/g, "");
}

// 最長共通部分文字列の長さ（短い本文同士なので素直な DP で十分）。
export function longestCommonSubstring(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (!x || !y) return { length: 0, text: "" };
  let best = 0;
  let end = 0;
  let prev = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i += 1) {
    const cur = new Array(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j += 1) {
      if (x[i - 1] === y[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) {
          best = cur[j];
          end = i;
        }
      }
    }
    prev = cur;
  }
  return { length: best, text: x.slice(end - best, end) };
}

function numberTokens(text) {
  return (normalizeText(text).replace(/,/g, "").match(/\d+/g) || []).map((n) => String(Number(n)));
}

function sectionTexts(draft) {
  const fact = draft.newsFact ? [draft.newsFact.lead, ...draft.newsFact.points.map((p) => `${p.label}：${p.value}`)].filter(Boolean).join("\n") : "";
  const data = draft.dataCheck ? draft.dataCheck.rows.map((r) => `${r.label}：${r.value}`).join("\n") : "";
  const view = draft.editorView ? draft.editorView.text : "";
  return { fact, data, view };
}

export function checkNewsDraft(draft, row) {
  const issues = [];
  const add = (code, severity, detail) => issues.push({ code, severity, detail });
  const { fact, data, view } = sectionTexts(draft);
  const body = [fact, data, view].filter(Boolean).join("\n");
  if (!body) return { ok: true, issues };

  // 1. 出典名・URL・宣伝文
  const source = body.match(SOURCE_NAME_RE);
  if (source) add("source_name", "error", `本文に出典名・URLが入っている（${source[0]}）`);
  if (isPromoText(body)) add("promo", "error", "収集時の定型文・宣伝文が入っている");

  // 2. 女子戦テンプレートの混入
  if (!isWomenNews(row) && WOMEN_RE.test(body)) add("women_leak", "error", `女子関連でない記事に「${body.match(WOMEN_RE)[0]}」が入っている`);

  // 3. 元記事の丸写し（見出し・要約と長く一致する部分）
  const { main } = splitHeadline(row);
  const summary = cleanSourceSummary(row?.summary).sentences.join("");
  for (const [label, sourceText] of [["見出し", main], ["要約", summary]]) {
    const lcs = longestCommonSubstring(withoutQuotes(normalizeText(fact + view)), withoutQuotes(normalizeText(sourceText)));
    if (lcs.length > COPY_LIMIT) add("copy", "error", `${label}と${lcs.length}文字連続で一致（${lcs.text}）`);
  }

  // 4. 根拠のない数値（NEWS FACT は出典、EDITOR'S VIEW は NEWS FACT と DATA CHECK にある数値だけ）
  const sourceText = `${row?.title || ""} ${row?.list_headline || ""} ${row?.summary || ""}`;
  const sourceNumbers = new Set(numberTokens(`${sourceText} ${row?.published_at || ""}`));
  // 「勝利・白星・V」は1着、「ポールポジション・イン」は1枠・1コースと同じ事実なので「1」を出典の数値として扱う。
  if (/勝利|白星|勝ち|勝目|連勝|圧勝|快勝|完勝|優勝|V|Ｖ|ポールポジション|イン/.test(sourceText)) sourceNumbers.add("1");
  const missingFact = numberTokens(fact).filter((n) => !sourceNumbers.has(n));
  if (missingFact.length) add("unsupported_number", "error", `NEWS FACT に出典にない数値: ${[...new Set(missingFact)].join(", ")}`);
  const materialNumbers = new Set([...numberTokens(fact), ...numberTokens(data), ...numberTokens(JSON.stringify(draft.dataCheck?.materials || {}))]);
  const missingView = numberTokens(view).filter((n) => !materialNumbers.has(n));
  if (missingView.length) add("unsupported_number", "error", `EDITOR'S VIEW に材料にない数値: ${[...new Set(missingView)].join(", ")}`);

  // 5. 予想・評価・意味のない定型文
  // 「」内は選手の談話として引用しているので対象外。
  const speculation = withoutQuotes(body).match(SPECULATION_RE);
  if (speculation) add("speculation", "error", `予想・定型表現「${speculation[0]}」が入っている`);

  // 6. 優勝戦・グレードの断定（DATA CHECK / EDITOR'S VIEW は DB で確認できた場合だけ）
  if (/優勝戦/.test(`${data}${view}`) && !draft.dataCheck?.finalConfirmed) add("unconfirmed_final", "error", "DBで確認できない優勝戦を DATA CHECK / EDITOR'S VIEW に書いている");
  if (/SG|G[123]/.test(`${data}${view}`) && !draft.dataCheck?.gradeConfirmed) add("unconfirmed_grade", "error", "DBで確認できないグレードを DATA CHECK / EDITOR'S VIEW に書いている");

  // 7. 重複
  const sentences = splitSentences(body.replace(/\n/g, "。")).map((s) => s.replace(/[。！？]$/, "")).filter((s) => s.length >= 6);
  const seen = new Set();
  for (const sentence of sentences) {
    if (seen.has(sentence)) add("duplicate", "warn", `同じ文が重複: ${sentence}`);
    seen.add(sentence);
  }

  // 8. 照合結果の不一致（自動では直さず、人の確認に回す）
  for (const c of draft.dataCheck?.checks || []) {
    if (c.result === "不一致") add("data_mismatch", "warn", `${c.item}: 記事「${c.claim}」／DB「${c.db}」`);
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
