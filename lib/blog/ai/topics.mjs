import { STADIUMS } from "../../stadiums.js";

// Themes the pipeline may propose. Each needs real sources: requiresDocuments means at least one
// successfully fetched official page for the stadium; otherwise generation stops before calling the AI.
export const AI_CATEGORIES = {
  "stadium-charm": { name: "24場の魅力", perStadium: true, author: "hatsune", requiresDocuments: true, angles: [
    ["facilities", s => `${s.name}の施設と場内の楽しみ方`],
    ["history", s => `${s.name}の歩みと歴史`],
    ["gourmet", s => `${s.name}の場内グルメ`],
  ] },
  "stadium-basics": { name: "24場の基本", perStadium: true, author: "ichika", requiresDocuments: false, angles: [
    ["water", s => `${s.name}の水面と干満差`],
    ["course", s => `${s.name}のコース別1着率を確認する`],
  ] },
  stadiums: { name: "24場攻略", perStadium: true, author: "ichika", requiresDocuments: false, angles: [
    ["inside", s => `${s.name}でイン逃げを考えるときの確認ポイント`],
    ["outer", s => `${s.name}で外コースを狙う前に見る数字`],
  ] },
  "data-lab": { name: "BoatStrikers DATA LAB", perStadium: false, author: "ichika", requiresDocuments: false, angles: [
    ["inside-24", () => "24場の1コース1着率を並べて見る"],
  ] },
  characters: { name: "キャラクター", perStadium: true, author: null, requiresDocuments: true, angles: [
    ["walk-ichika", s => `一果と巡る${s.name}`, "ichika"],
    ["walk-hatsune", s => `初音と巡る${s.name}`, "hatsune"],
    ["walk-kiina", s => `キイナと巡る${s.name}`, "kiina"],
  ] },
};

export function stadiumBySlug(slug) {
  return STADIUMS.find(s => s.slug === slug) || null;
}

export function topicKey(categorySlug, stadiumSlug, angle) {
  return `${categorySlug}:${stadiumSlug || "all"}:${angle}`;
}

export function topicSlug(topic) {
  return [topic.category_slug, topic.stadium_slug, topic.angle].filter(Boolean).join("-");
}

// All candidates for one category (optionally one stadium), minus keys that already exist.
export function candidateTopics({ categorySlug, stadiumSlug = null, existingKeys = [] }) {
  const category = AI_CATEGORIES[categorySlug];
  if (!category) throw Object.assign(new Error("カテゴリーを確認してください。"), { status: 400 });
  const taken = new Set(existingKeys);
  const stadiums = category.perStadium ? (stadiumSlug ? [stadiumBySlug(stadiumSlug)] : STADIUMS) : [null];
  if (stadiums.some(s => s === null) && category.perStadium) throw Object.assign(new Error("場を確認してください。"), { status: 400 });
  const out = [];
  for (const stadium of stadiums) for (const [angle, title, character] of category.angles) {
    const key = topicKey(categorySlug, stadium?.slug, angle);
    if (taken.has(key)) continue;
    out.push({ topic_key: key, category_slug: categorySlug, stadium_slug: stadium?.slug ?? null, angle,
      title_hint: title(stadium), character_key: character || category.author });
  }
  return out;
}

// Character-bigram Dice similarity on normalised text; catches near-duplicate titles across sources.
function normalize(text) {
  return String(text || "").normalize("NFKC").toLowerCase().replace(/[\s「」『』（）()【】・、。！？!?:：|｜\-]/g, "");
}
function bigrams(text) {
  const s = normalize(text), out = new Map();
  for (let i = 0; i < s.length - 1; i++) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) || 0) + 1);
  return out;
}
export function similarity(a, b) {
  const x = bigrams(a), y = bigrams(b);
  let shared = 0, total = 0;
  for (const [k, n] of x) { shared += Math.min(n, y.get(k) || 0); total += n; }
  for (const n of y.values()) total += n;
  return total ? (2 * shared) / total : 0;
}

export function similarTitles(title, existing, threshold = 0.6) {
  return existing.map(item => ({ ...item, score: similarity(title, item.title) }))
    .filter(item => item.score >= threshold).sort((a, b) => b.score - a.score);
}
