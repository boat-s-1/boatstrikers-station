import { randomUUID } from "node:crypto";
import { validateDocument, blankDocument } from "../document.mjs";
import { topicSlug, AI_CATEGORIES } from "./topics.mjs";

const TYPE = { text: "TEXT", point: "POINT", warning: "WARNING", data_check: "DATA_CHECK" };
const clip = (value, n) => String(value ?? "").trim().slice(0, n);
const jst = iso => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

// Fixed wording added by the system, never by the AI. Marked so validators can skip them.
export const NOTE_TEXT = "この記事は、出典欄の公式情報・収録データをもとに作成しています。開催・施設・メニューなどの最新情報は各公式サイトでご確認ください。舟券の購入はご自身の判断でお願いします。";

export function sourceLine(source) {
  const when = source.fetched_at ? `取得日時 ${jst(source.fetched_at)}` : `取得日時 記録なし（集計期間 ${source.period}）`;
  return `${source.label}｜${when}`;
}

// ai: output of ARTICLE_SCHEMA. catalogue: { categoryId, authorIds: { slug: uuid } }.
export function composeDocument({ ai, pack, topic, catalogue, coverMediaId = null, coverAlt = "", id = randomUUID }) {
  const issues = [];
  const sources = new Map(pack.sources.map(s => [s.id, s]));
  const cite = (ids, where) => {
    const known = (ids || []).filter(x => sources.has(x));
    for (const unknown of (ids || []).filter(x => !sources.has(x))) issues.push({ level: "blocking", code: "unknown_source", message: `存在しない出典ID「${clip(unknown, 20)}」が使われています（${where}）。` });
    if (!known.length) return {};
    const first = sources.get(known[0]);
    return { source_url: first.url, source_label: known.map(x => sources.get(x).label).join(" / ").slice(0, 500), source_ids: known };
  };
  const blocks = [];
  const takeaways = (ai.takeaways || []).map(x => clip(x, 300)).filter(Boolean);
  if (takeaways.length) blocks.push({ id: id(), type: "LIST", data: { items: takeaways, placement: "takeaways" } });
  (ai.sections || []).forEach((section, si) => {
    if (clip(section.heading, 200)) blocks.push({ id: id(), type: "HEADING", data: { level: 2, text: clip(section.heading, 200) } });
    (section.blocks || []).forEach((b, bi) => {
      const where = `セクション${si + 1}・ブロック${bi + 1}`;
      if (b.type === "dialogue") {
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
  if (clip(ai.summary, 2000)) blocks.push({ id: id(), type: "TEXT", data: { text: clip(ai.summary, 2000), placement: "summary" } });
  blocks.push({ id: id(), type: "WARNING", data: { text: NOTE_TEXT, placement: "notes", system: true } });
  for (const source of pack.sources) blocks.push({ id: id(), type: "QUOTE", data: { text: sourceLine(source), source_url: source.url, source_label: source.label.slice(0, 500), placement: "sources", system: true } });

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
