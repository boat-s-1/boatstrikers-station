import { STADIUM_BASIC_GUIDES } from "../../stadiumBasicGuide24.js";
import { STADIUMS } from "../../stadiums.js";
import { AI_CATEGORIES, stadiumBySlug } from "./topics.mjs";

const DOC_EXCERPT = 6000;
const MAX_DOCS = 3;

// Repository dataset: BOAT RACE official stadium data, aggregated for a fixed period and stored in
// lib/stadiumBasicGuide24.js. Its retrieval time is not recorded in the file, so fetched_at stays null
// and the validator warns the reviewer; the period is always shown.
function guideSource(guide, id) {
  return { id, kind: "repository_dataset", label: `BOAT RACE公式データ（${guide.name}・${guide.periodFrom}〜${guide.periodTo}集計）`,
    url: guide.officialUrl, fetched_at: null, period: `${guide.periodFrom}〜${guide.periodTo}`, recorded_in: "lib/stadiumBasicGuide24.js" };
}

function guideFacts(guide, sourceId, next) {
  const facts = [
    [`${guide.name}のレース時間帯`, guide.raceType, ""],
    [`${guide.name}の水質`, guide.waterType, ""],
    [`${guide.name}の干満差`, guide.tide, ""],
    ...guide.courseWinRates.map((rate, i) => [`${guide.name}の${i + 1}コース1着率`, String(rate), "%"]),
  ];
  return facts.map(([label, value, unit]) => ({ id: next(), source_id: sourceId, label, value, unit }));
}

// documents: rows of blog_source_documents (newest first). Only successful fetches are used.
export function buildSourcePack({ topic, documents = [], now = () => new Date() }) {
  const category = AI_CATEGORIES[topic.category_slug];
  if (!category) throw Object.assign(new Error("カテゴリーを確認してください。"), { status: 400 });
  let s = 0, f = 0;
  const nextSource = () => `S${++s}`, nextFact = () => `F${++f}`;
  const sources = [], facts = [], docs = [], gaps = [];
  const stadium = topic.stadium_slug ? stadiumBySlug(topic.stadium_slug) : null;
  if (category.perStadium && !stadium) throw Object.assign(new Error("場を確認してください。"), { status: 400 });

  const guides = stadium ? STADIUM_BASIC_GUIDES.filter(g => g.slug === stadium.slug) : STADIUM_BASIC_GUIDES;
  if (topic.category_slug !== "stadium-charm") for (const guide of guides) {
    const source = guideSource(guide, nextSource());
    sources.push(source);
    facts.push(...guideFacts(guide, source.id, nextFact));
  }

  const seen = new Set();
  for (const d of documents) {
    if (docs.length >= MAX_DOCS) break;
    if (d.fetch_error || !d.extracted_text || seen.has(d.url) || (stadium && d.stadium_slug !== stadium.slug)) continue;
    seen.add(d.url);
    const source = { id: nextSource(), kind: d.kind, label: d.title ? `${d.title}` : d.url, url: d.url, fetched_at: d.fetched_at, content_sha256: d.content_sha256 };
    sources.push(source);
    docs.push({ source_id: source.id, title: d.title || "", excerpt: d.extracted_text.slice(0, DOC_EXCERPT) });
  }
  if (category.requiresDocuments && !docs.length) gaps.push("official_documents_missing");
  if (docs.length && topic.category_slug === "stadium-charm" && topic.angle === "gourmet" && !docs.some(d => /グルメ|食|メニュー|売店|レストラン/.test(d.excerpt))) gaps.push("gourmet_information_not_found");

  return {
    version: 1, built_at: now().toISOString(),
    topic: { topic_key: topic.topic_key, category_slug: topic.category_slug, stadium_slug: topic.stadium_slug ?? null,
      angle: topic.angle, title_hint: topic.title_hint, character_key: topic.character_key ?? null },
    stadium: stadium ? { slug: stadium.slug, name: stadium.name, course_code: stadium.courseCode } : null,
    stadium_count: stadium ? 1 : STADIUMS.length,
    sources, facts, documents: docs, gaps,
  };
}
