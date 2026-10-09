import { BANNED_PHRASES, PERSONAS } from "./personas.mjs";

// Checks an AI draft (or a human-edited version of it) against its source pack.
// blocking issues prevent approval; warnings are shown to the reviewer.
const SMALL_INT_UNITS = /^(コース|号艇|艇|R|レース|着|マーク|周|人|位|番|つ|か所|カ所|点|個|項目|場)/;
const NUMBER = /\d+(?:[.,]\d+)*/g;
const URL = /https?:\/\/[^\s「」『』（）()<>"']+/g;

function norm(text) { return String(text ?? "").normalize("NFKC"); }
function numberForms(raw) {
  const plain = raw.replace(/,/g, "");
  const out = new Set([raw, plain]);
  if (/^\d+\.\d+$/.test(plain)) out.add(String(Number(plain)));
  return out;
}

export function allowedNumbers(pack) {
  const allowed = new Set();
  const add = text => { for (const m of norm(text).matchAll(NUMBER)) for (const f of numberForms(m[0])) allowed.add(f); };
  for (const f of pack.facts || []) { add(f.value); add(f.label); }
  for (const d of pack.documents || []) { add(d.excerpt); add(d.title); }
  for (const s of pack.sources || []) { add(s.label); add(s.period); }
  add(pack.topic?.title_hint);
  if (pack.stadium?.course_code) add(String(pack.stadium.course_code));
  add(String(pack.stadium_count ?? ""));
  return allowed;
}

// Text written by the AI (or editor), excluding the system-generated notes/sources blocks.
export function authoredTexts(document) {
  const out = [{ where: "タイトル", text: document.title }, { where: "抜粋", text: document.excerpt },
    { where: "SEOタイトル", text: document.seo?.title }, { where: "SEO説明文", text: document.seo?.description }];
  document.blocks.forEach((b, i) => {
    if (b.data?.system) return;
    const where = `ブロック${i + 1}（${b.type}）`;
    const cited = Boolean(b.data?.source_url);
    if (cited) out.push({ where, sourceUrl: b.data.source_url, text: "" });
    if (b.type === "DIALOGUE_SCENE") b.data.turns.forEach(t => out.push({ where, text: t.text, cited, character: t.character, block: i }));
    else if (["DIALOGUE", "AI_MATE"].includes(b.type)) out.push({ where, text: b.data.text, cited, character: b.data.character, block: i });
    else if (b.type === "LIST") b.data.items.forEach(x => out.push({ where, text: x, cited, block: i }));
    else if (b.type === "TABLE") b.data.rows.flat().forEach(x => out.push({ where, text: x, cited, block: i }));
    else out.push({ where, text: b.data?.text ?? b.data?.caption ?? "", cited, block: i });
  });
  return out.filter(x => x.text || x.sourceUrl);
}

export function validateAiDocument({ document, pack }) {
  const issues = [];
  const push = (level, code, message) => issues.push({ level, code, message });
  const allowed = allowedNumbers(pack);
  const sourceUrls = new Set((pack.sources || []).map(s => s.url));

  for (const item of authoredTexts(document)) {
    // Every citation must point at a registered source, so its retrieval/check time is on record.
    if (item.sourceUrl) { if (!sourceUrls.has(item.sourceUrl)) push("blocking", "unregistered_source", `${item.where}：出典URLが登録されていません。「出典を追加」で取得日時と一緒に登録してください。`); continue; }
    const text = norm(item.text);
    for (const m of text.matchAll(NUMBER)) {
      const value = m[0], after = text.slice(m.index + value.length), plain = value.replace(/,/g, "");
      const smallInt = /^\d+$/.test(plain) && Number(plain) >= 1 && Number(plain) <= 12 && SMALL_INT_UNITS.test(after);
      const stadiumCount = plain === "24" && /^場/.test(after);
      if (smallInt || stadiumCount) continue;
      if (![...numberForms(value)].some(f => allowed.has(f))) push("blocking", "unsupported_number", `${item.where}：出典にない数値「${value}」があります。`);
      else if (item.block !== undefined && !item.cited) push("blocking", "missing_source", `${item.where}：数値「${value}」を使っていますが、出典が設定されていません。`);
    }
    for (const url of text.match(URL) || []) if (!sourceUrls.has(url)) push("blocking", "unknown_url", `${item.where}：出典にないURLがあります。`);
    for (const phrase of BANNED_PHRASES) if (text.includes(phrase)) push("blocking", "banned_phrase", `${item.where}：使用できない表現「${phrase}」があります。`);
    const avoid = PERSONAS[item.character]?.avoid || [];
    for (const phrase of avoid) if (text.includes(phrase)) push("warning", "persona_phrase", `${item.where}：${PERSONAS[item.character].name}の口調ルールで避ける表現「${phrase}」があります。`);
  }
  for (const s of pack.sources || []) if (!s.fetched_at) push("warning", "source_without_fetch_time", `出典「${s.label}」は取得日時の記録がない収録データです。公開前に公式ページの内容と一致するか確認してください。`);
  for (const gap of pack.gaps || []) push(gap === "official_documents_missing" ? "blocking" : "warning", gap,
    gap === "official_documents_missing" ? "公式情報を取得できていません。URLを登録して取得してください。" : "グルメなど、取得した公式情報で確認できない項目があります。");
  if (!document.blocks.some(b => b.data?.placement === "sources")) push("blocking", "no_sources", "出典欄がありません。");
  if ((document.title || "").length > 60) push("warning", "long_title", "タイトルが60文字を超えています。");
  const description = document.seo?.description || "";
  if (description.length < 50 || description.length > 160) push("warning", "seo_description_length", "SEO説明文は50〜160文字を目安にしてください。");
  // Deduplicate identical messages to keep the review list readable.
  const seen = new Set();
  return issues.filter(i => { const k = `${i.level}|${i.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export const blockingCount = issues => issues.filter(i => i.level === "blocking").length;
