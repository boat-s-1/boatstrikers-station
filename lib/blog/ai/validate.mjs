import { BANNED_PHRASES, PERSONAS } from "./personas.mjs";
import { claimsIn, evidence, supportingSources, dateMatches, jstDate, norm, pad } from "./claims.mjs";
import { emptyItems, emptyCells, raggedRows } from "../blockEdits.mjs";
import { qualityIssues } from "./quality.mjs";
import { statementSourceIds } from "./dataReadings.mjs";
import { comparisonIssue } from "./comparison.mjs";

// Checks an AI draft (or a human-edited version of it) against its source pack.
// blocking issues prevent approval; warnings are shown to the reviewer.
const URL = /https?:\/\/[^\s「」『』（）()<>"']+/g;

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
    else if (b.type === "TABLE") [b.data.caption, ...b.data.rows.flat()].filter(Boolean).forEach(x => out.push({ where, text: x, cited, block: i }));
    else out.push({ where, text: b.data?.text ?? b.data?.caption ?? "", cited, block: i });
  });
  return out.filter(x => x.text || x.sourceUrl);
}

// Sources a block cites: its source_ids while they still belong to its source_url (compose sets the URL of the
// first id); once an editor points the block at another URL, every registered source with that URL.
export function citedSourceIds(block, ev) {
  const url = block.data?.source_url;
  if (!url) return [];
  const ids = (block.data.source_ids || []).filter(id => ev.sources.has(id));
  if (ids.length && ev.sources.get(ids[0]).url === url) return ids;
  return [...ev.sources.values()].filter(s => s.url === url).map(s => s.id);
}

const MESSAGES = {
  unsupported_number: (where, v) => `${where}：出典にない数値「${v}」があります。`,
  unsupported_date: (where, v) => `${where}：出典の集計期間・取得日にない日付「${v}」があります。`,
  missing_source: (where, v) => `${where}：数値・日付「${v}」を使っていますが、出典が設定されていません。`,
  source_mismatch: (where, v, ids) => `${where}：「${v}」は、設定された出典（${ids}）にありません。別の出典・集計期間の値ではないか確認し、出典を設定し直してください。`,
  period_mismatch: (where, v, periods) => `${where}：日付「${v}」が、同じブロックの数値の集計期間（${periods}）と一致しません。`,
  heading_unsupported: (where, v) => `${where}：見出しの「${v}」は、同じセクションの出典付きブロックで裏付けられていません。`,
  unknown_source: (where, v) => `${where}：この記事に登録されていない出典ID「${v}」が設定されています。登録済みの出典から選び直してください。`,
};

function gapIssue(gap, pack) {
  if (gap === "official_documents_missing") return ["blocking", "公式情報を取得できていません。URLを登録して取得してください。"];
  if (gap === "official_table_unreadable") {
    const fallback = (pack.sources || []).find(s => s.kind === "repository_dataset");
    return ["warning", `BOAT RACE公式の場データの表を読み取れませんでした（${pack.official?.reason ?? "形式が想定と異なります"}）。最新の数値を確認できていないため、公式ページの数値は使っていません。${fallback ? `収録データ（集計期間 ${fallback.period}）の数値は、公式ページで最新か確認してから承認してください。` : ""}`];
  }
  if (gap === "repository_data_conflict") return ["warning", `収録データと当日取得した公式ページで値が異なります（${(pack.conflicts || []).map(c => `${c.label}：収録「${c.repository}」→公式「${c.official}」`).join("、")}）。公式ページの値を使っています。`];
  return ["warning", "グルメなど、取得した公式情報で確認できない項目があります。"];
}

export function validateAiDocument({ document, pack }) {
  const issues = [];
  const push = (level, code, message) => issues.push({ level, code, message });
  const ev = evidence(pack);
  const sourceUrls = new Set((pack.sources || []).map(s => s.url));
  // One issue per place and cause, listing every value it concerns.
  const grouped = new Map();
  const note = (where, code, label, detail = "") => {
    const key = `${where}|${code}|${detail}`;
    if (!grouped.has(key)) grouped.set(key, { where, code, detail, values: [] });
    const g = grouped.get(key);
    if (!g.values.includes(label)) g.values.push(label);
  };
  const unsupported = claim => (claim.kind === "date" ? "unsupported_date" : "unsupported_number");

  // Title, excerpt and SEO texts carry no citation of their own; their numbers and dates must come from a source.
  for (const [where, text] of [["タイトル", document.title], ["抜粋", document.excerpt], ["SEOタイトル", document.seo?.title], ["SEO説明文", document.seo?.description]]) {
    for (const claim of claimsIn(text)) if (!supportingSources(claim, ev).length) note(where, unsupported(claim), claim.label);
  }

  const blocks = document.blocks.map((b, i) => ({ b, i, where: `ブロック${i + 1}（${b.type}）`, cited: Boolean(b.data?.source_url),
    ids: citedSourceIds(b, ev), claims: blockTexts(b).flatMap(t => claimsIn(t)) }));
  for (const x of blocks) {
    if (!x.b.data?.system) for (const id of x.b.data?.source_ids || []) if (!ev.sources.has(id)) note(x.where, "unknown_source", String(id).slice(0, 20));
    if (x.b.data?.system || x.b.type === "HEADING" || !x.claims.length) continue;
    if (!x.cited) {
      for (const claim of x.claims) note(x.where, supportingSources(claim, ev).length ? "missing_source" : unsupported(claim), claim.label);
      continue;
    }
    for (const claim of x.claims) {
      claim.ok = supportingSources(claim, ev, x.ids).length > 0;
      if (!claim.ok) note(x.where, supportingSources(claim, ev).length ? "source_mismatch" : unsupported(claim), claim.label, x.ids.join("・"));
    }
    // A date written next to period-bound numbers (e.g. course rates) must be that period, or the retrieval date.
    const periods = x.claims.filter(c => c.ok && c.kind === "number")
      .flatMap(c => [...c.forms].flatMap(f => ev.factPeriods.get(f) || [])).filter(p => x.ids.includes(p.source_id));
    if (periods.length) {
      const fetched = x.ids.map(id => ev.sources.get(id)?.fetched_at).filter(Boolean).flatMap(iso => [jstDate(iso)]);
      const allowed = [...periods.flatMap(p => p.dates), ...fetched];
      const label = [...new Set(periods.map(p => p.dates.map(d => `${d.year}/${pad(d.month)}/${pad(d.day)}`).join("〜")))].join("、");
      for (const claim of x.claims) if (claim.ok && claim.kind === "date" && !allowed.some(d => dateMatches(claim, d))) note(x.where, "period_mismatch", claim.label, label);
    }
  }
  // Headings show no citation: a number or date there must also appear, correctly cited, in the same section.
  blocks.forEach((x, n) => {
    if (x.b.type !== "HEADING" || !x.claims.length) return;
    const section = [];
    for (const y of blocks.slice(n + 1)) { if (y.b.type === "HEADING" || y.b.data?.placement) break; section.push(y); }
    const backed = section.filter(y => y.cited).flatMap(y => y.claims.filter(c => c.ok));
    for (const claim of x.claims) {
      const same = backed.some(c => c.kind === claim.kind && (claim.kind === "number" ? [...claim.forms].some(f => c.forms.has(f)) : c.label === claim.label || (c.year === claim.year && c.month === claim.month && c.day === claim.day)));
      if (!same) note(x.where, supportingSources(claim, ev).length ? "heading_unsupported" : unsupported(claim), claim.label);
    }
  });
  for (const g of grouped.values()) push("blocking", g.code, MESSAGES[g.code](g.where, g.values.join("」「"), g.detail));
  // Empty list items / table cells and uneven rows are saved as they are but show as blank lines on the page.
  for (const x of blocks) {
    if (x.b.data?.system) continue;
    if (x.b.type === "LIST" && (!x.b.data.items.length || emptyItems(x.b.data.items))) push("warning", "empty_entries", `${x.where}：空の項目があります。入力するか、「空の項目を削除」で取り除いてください。`);
    if (x.b.type === "TABLE" && (!x.b.data.rows.length || emptyCells(x.b.data.rows) || raggedRows(x.b.data.rows))) push("warning", "empty_entries", `${x.where}：空のセル・空の行、または列数のそろっていない行があります。表の編集欄で整えてください。`);
  }

  for (const item of authoredTexts(document)) {
    // Every citation must point at a registered source, so its retrieval/check time is on record.
    if (item.sourceUrl) { if (!sourceUrls.has(item.sourceUrl)) push("blocking", "unregistered_source", `${item.where}：出典URLが登録されていません。「出典を追加」で取得日時と一緒に登録してください。`); continue; }
    const text = norm(item.text);
    for (const url of text.match(URL) || []) if (!sourceUrls.has(url)) push("blocking", "unknown_url", `${item.where}：出典にないURLがあります。`);
    for (const phrase of BANNED_PHRASES) if (text.includes(phrase)) push("blocking", "banned_phrase", `${item.where}：使用できない表現「${phrase}」があります。`);
    const avoid = PERSONAS[item.character]?.avoid || [];
    for (const phrase of avoid) if (text.includes(phrase)) push("warning", "persona_phrase", `${item.where}：${PERSONAS[item.character].name}の口調ルールで避ける表現「${phrase}」があります。`);
  }
  // Comparisons and facts written without numbers ("1コースが最も高い", "水質は海水") need a citation too. Warned, not
  // blocked: the numbers they rest on are checked above, and drafts written before this check stay approvable.
  for (const x of blocks) {
    if (x.cited || x.b.data?.system || x.b.type === "HEADING") continue;
    const ids = [...new Set(blockTexts(x.b).flatMap(t => statementSourceIds(t, pack)))];
    if (ids.length) push("warning", "statement_without_source", `${x.where}：データの比較・事実を書いていますが、出典が設定されていません（該当する出典：${ids.join("・")}）。「このブロックの出典」で設定してください。`);
  }
  for (const s of pack.sources || []) {
    if (s.fetched_at) continue;
    const supplied = (pack.facts || []).filter(f => f.source_id === s.id && !f.period).map(f => `${String(f.label).replace(`${pack.stadium?.name ?? ""}の`, "")}「${f.value}」`);
    const what = supplied.length && !s.period ? `（この出典の事実：${supplied.join("、")}）` : "";
    push("warning", "source_without_fetch_time", `出典「${s.label}」は取得日時の記録がない収録データです${what}。公開前に公式情報で確認し、確認したページは「人が追記した事実の出典を登録する」でURL・確認日時と一緒に登録して、そのブロックの出典を切り替えてください（確認できない場合はその事実を削ってください）。`);
  }
  for (const gap of pack.gaps || []) { const [level, message] = gapIssue(gap, pack); push(level, gap, message); }
  if (!document.blocks.some(b => b.data?.placement === "sources")) push("blocking", "no_sources", "出典欄がありません。");
  if ((document.title || "").length > 60) push("warning", "long_title", "タイトルが60文字を超えています。");
  const description = document.seo?.description || "";
  if (description.length < 50 || description.length > 160) push("warning", "seo_description_length", "SEO説明文は50〜160文字を目安にしてください。");
  issues.push(...qualityIssues({ document, pack }));
  // A comparison draft (a second draft of the same theme) can never be approved; see comparison.mjs.
  const comparison = comparisonIssue(pack);
  if (comparison) issues.unshift(comparison);
  // Deduplicate identical messages to keep the review list readable.
  const seen = new Set();
  return issues.filter(i => { const k = `${i.level}|${i.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

function blockTexts(b) {
  if (b.type === "DIALOGUE_SCENE") return b.data.turns.map(t => t.text);
  if (b.type === "LIST") return b.data.items;
  if (b.type === "TABLE") return [b.data.caption, ...b.data.rows.flat()].filter(Boolean);
  return [b.data?.text ?? b.data?.caption ?? ""];
}

export const blockingCount = issues => issues.filter(i => i.level === "blocking").length;
