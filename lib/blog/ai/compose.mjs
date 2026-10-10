import { randomUUID } from "node:crypto";
import { validateDocument, blankDocument } from "../document.mjs";
import { topicSlug, AI_CATEGORIES } from "./topics.mjs";
import { claimsIn, evidence, norm, supportingSources } from "./claims.mjs";
import { rateTable, statementSourceIds } from "./dataReadings.mjs";
import { RATE_WARNING, RATE_WARNING_PATTERN } from "./glossary.mjs";

const TYPE = { text: "TEXT", point: "POINT", warning: "WARNING", data_check: "DATA_CHECK" };
const clip = (value, n) => String(value ?? "").trim().slice(0, n);
const jst = iso => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

// Fixed wording added by the system, never by the AI. Marked so validators can skip them.
export const NOTE_TEXT = "この記事は、出典欄の公式情報・収録データをもとに作成しています。開催・施設・メニューなどの最新情報は各公式サイトでご確認ください。舟券の購入はご自身の判断でお願いします。";

// Reader-facing line for the sources section: name｜collection period(s)｜retrieval time.
// periods: the periods of the facts taken from this source (the source's own period is used when it has one).
export function sourceLine(source, periods = []) {
  const all = [...new Set([source.period, ...periods].filter(Boolean))];
  const when = source.fetched_at ? `取得日時 ${jst(source.fetched_at)}` : "取得日時 記録なし";
  return [source.label, all.length ? `集計期間 ${all.join("、")}` : null, when].filter(Boolean).join("｜");
}

// ai: output of ARTICLE_SCHEMA. catalogue: { categoryId, authorIds: { slug: uuid } }.
export function composeDocument({ ai, pack, topic, catalogue, coverMediaId = null, coverAlt = "", id = randomUUID }) {
  const issues = [];
  const sources = new Map(pack.sources.map(s => [s.id, s]));
  const cite = (ids, where) => {
    const known = (ids || []).filter(x => sources.has(x));
    for (const unknown of (ids || []).filter(x => !sources.has(x))) issues.push({ level: "blocking", code: "unknown_source", message: `存在しない出典ID「${clip(unknown, 20)}」が使われています（${where}）。` });
    if (!known.length) return {};
    // The fetched official page first, so the block's link is the page retrieved for this article.
    known.sort((a, b) => Number(Boolean(sources.get(b).fetched_at)) - Number(Boolean(sources.get(a).fetched_at)));
    const first = sources.get(known[0]);
    return { source_url: first.url, source_label: known.map(x => sources.get(x).label).join(" / ").slice(0, 500), source_ids: known };
  };
  const blocks = [];
  // The course-rate table is built from the facts, never typed by the AI: only when one complete table exists.
  const table = rateTable(pack.facts);
  let tablePlaced = false;
  const tableBlock = () => {
    tablePlaced = true;
    const rows = [["コース", "1着率"], ...table.rates.map(r => [`${r.course}コース`, `${r.text}%`])];
    return { id: id(), type: "TABLE", data: { caption: `${pack.stadium?.name ?? ""}のコース別1着率（集計期間 ${table.period}）`.replace(/^の/, ""), header: true, rows, generated: "rate_table", ...cite([table.source_id], "1着率の表") } };
  };
  const takeaways = (ai.takeaways || []).map(x => clip(x, 300)).filter(Boolean);
  if (takeaways.length) blocks.push({ id: id(), type: "LIST", data: { items: takeaways, placement: "takeaways" } });
  // The lead opens the body (before the first heading); the public page shows it as body text. Cited like the summary.
  if (clip(ai.lead, 1000)) blocks.push({ id: id(), type: "TEXT", data: { text: clip(ai.lead, 1000), placement: "lead" } });
  (ai.sections || []).forEach((section, si) => {
    if (clip(section.heading, 200)) blocks.push({ id: id(), type: "HEADING", data: { level: 2, text: clip(section.heading, 200) } });
    (section.blocks || []).forEach((b, bi) => {
      const where = `セクション${si + 1}・ブロック${bi + 1}`;
      if (b.type === "rate_table") {
        if (table && !tablePlaced) blocks.push(tableBlock());
        else if (!table) issues.push({ level: "warning", code: "rate_table_unavailable", message: `${where}：6コース分の1着率・集計期間・出典がそろっていないため、1着率の表は作りませんでした。` });
      } else if (b.type === "dialogue") {
        const turns = (b.turns || []).filter(t => clip(t.text, 2000)).map(t => ({ id: id(), character: t.character, pose: t.pose, text: clip(t.text, 2000), alignment: "auto" }));
        if (turns.length) blocks.push({ id: id(), type: "DIALOGUE_SCENE", data: { label: "", turns, ...cite(b.source_ids, where) } });
      } else if (b.type === "list") {
        const items = (b.items || []).map(x => clip(x, 500)).filter(Boolean);
        if (items.length) blocks.push({ id: id(), type: "LIST", data: { items, ...cite(b.source_ids, where) } });
      } else if (TYPE[b.type] && clip(b.text, 5000)) {
        blocks.push({ id: id(), type: TYPE[b.type], data: { text: clip(b.text, 5000), ...cite(b.source_ids, where) } });
      }
    });
  });
  // The AI left the table out (and did not list the rates itself, as answers before blog-ai-v5 do): place it after
  // the first block of the section about the 1着率.
  const shows = (text, value) => new RegExp(`(?<![\\d.])${value.replace(".", "\\.")}%`).test(norm(text));
  const listed = blocks.some(b => table && table.rates.filter(r => shows((b.type === "LIST" ? b.data.items : [b.data.text ?? ""]).join("\n"), r.text)).length >= 5);
  if (table && !tablePlaced && !listed) {
    const heading = blocks.findIndex(b => b.type === "HEADING" && /1着率/.test(b.data.text));
    const at = heading >= 0 ? heading + 2 : -1;
    if (at > 0 && at <= blocks.length) blocks.splice(at, 0, tableBlock());
  }
  // blog-ai-v8 (packs from version 4): the course-rate caveat, kept out of the definition, is always in the WARNING —
  // added to the article's own WARNING when the AI left it out, or as a WARNING at the end of the body.
  if (table && (pack.version ?? 0) >= 4 && !blocks.some(b => b.type === "WARNING" && RATE_WARNING_PATTERN.test(b.data.text || ""))) {
    const own = blocks.filter(b => b.type === "WARNING" && !b.data.placement).at(-1);
    if (own) own.data.text = `${own.data.text.replace(/\s+$/, "")}${/[。！？]$/.test(own.data.text.trim()) ? "" : "。"}${RATE_WARNING}`;
    else blocks.push({ id: id(), type: "WARNING", data: { text: RATE_WARNING } });
  }
  if (clip(ai.summary, 2000)) blocks.push({ id: id(), type: "TEXT", data: { text: clip(ai.summary, 2000), placement: "summary" } });
  autoCite(blocks, pack, cite, issues);
  blocks.push({ id: id(), type: "WARNING", data: { text: NOTE_TEXT, placement: "notes", system: true } });
  for (const source of pack.sources) {
    const periods = (pack.facts || []).filter(f => f.source_id === source.id && f.period).map(f => f.period);
    blocks.push({ id: id(), type: "QUOTE", data: { text: sourceLine(source, periods), source_url: source.url, source_label: source.label.slice(0, 500), placement: "sources", system: true } });
  }

  const category = AI_CATEGORIES[topic.category_slug];
  const author = topic.character_key || category.author;
  const authorId = catalogue.authorIds[author];
  if (!authorId || !catalogue.categoryId) throw Object.assign(new Error("カテゴリー・著者がBLOGに登録されていません。"), { status: 409 });
  const document = validateDocument({
    ...blankDocument(),
    title: clip(ai.title, 200), excerpt: clip(ai.excerpt, 2000), category_id: catalogue.categoryId,
    seo: { title: clip(ai.seo_title, 200), description: clip(ai.seo_description, 1000),
      ...(topic.stadium_slug ? { stadium_slug: topic.stadium_slug } : {}),
      ...(coverMediaId ? { og_media_id: coverMediaId, og_alt: clip(coverAlt, 500) } : {}) },
    cover: coverMediaId ? { media_id: coverMediaId } : {},
    author_ids: [authorId], blocks,
  });
  for (const item of ai.needs_check || []) if (clip(item, 300)) issues.push({ level: "warning", code: "needs_check", message: `要確認：${clip(item, 300)}` });
  return { slug: topicSlug(topic), document, issues };
}

// Takeaways and the summary have no citation field in the AI output, and the AI may leave a block uncited.
// When every number and date in such a block is recorded in the pack, cite the sources that record them
// (the fetched official page first), together with the sources of the comparisons and facts it states without
// numbers, and tell the reviewer. A block with anything unrecorded stays uncited,
// so the validator still reports it. Headings are never cited: they are checked against their section.
function autoCite(blocks, pack, cite, issues) {
  const ev = evidence(pack);
  const order = [...pack.sources].sort((a, b) => Number(Boolean(b.fetched_at)) - Number(Boolean(a.fetched_at))).map(s => s.id);
  blocks.forEach((b, i) => {
    if (b.type === "HEADING" || b.data.source_url) return;
    const texts = b.type === "LIST" ? b.data.items : b.type === "DIALOGUE_SCENE" ? b.data.turns.map(t => t.text) : [b.data.text];
    const claims = texts.flatMap(t => claimsIn(t));
    // Statements without numbers ("1コースが最も高い", "水質は海水") rest on the source of the facts they state.
    const stated = texts.flatMap(t => statementSourceIds(t, pack));
    if (!claims.length && !stated.length) return;
    const ids = [];
    for (const claim of claims) {
      const found = supportingSources(claim, ev, order);
      if (!found.length) return;
      if (!found.some(x => ids.includes(x))) ids.push(found[0]);
    }
    for (const sid of stated) if (!ids.includes(sid)) ids.push(sid);
    Object.assign(b.data, cite(ids, `ブロック${i + 1}`));
    const what = claims.length && stated.length ? "数値・日付・特徴" : claims.length ? "数値・日付" : "比較・事実";
    issues.push({ level: "warning", code: "auto_cited", message: `ブロック${i + 1}（${b.type}）：${what}の出典を自動で設定しました（${ids.join("・")}）。内容と出典が合っているか確認してください。` });
  });
}
