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
    // 初音 leads: the water theme told from a beginner's questions (一果 answers them in the dialogue).
    ["water-hatsune", s => `初音と見る${s.name}の水面と干満差`, "hatsune", "water"],
  ] },
  stadiums: { name: "24場攻略", perStadium: true, author: "ichika", requiresDocuments: false, angles: [
    ["inside", s => `${s.name}でイン逃げを考えるときの確認ポイント`],
    ["outer", s => `${s.name}で外コースを狙う前に見る数字`],
    // キイナ leads: what she notices about the outer courses in the data (一果 says how to read it in the dialogue).
    ["outer-kiina", s => `キイナが気づいた${s.name}の外コースの数字`, "kiina", "outer"],
  ] },
  "data-lab": { name: "BoatStrikers DATA LAB", perStadium: false, author: "ichika", requiresDocuments: false, angles: [
    ["inside-24", () => "24場の1コース1着率を並べて見る"],
  ] },
  characters: { name: "キャラクター", perStadium: true, author: null, requiresDocuments: true, angles: [
    ["walk-ichika", s => `一果と巡る${s.name}`, "ichika"],
    ["walk-hatsune", s => `初音と巡る${s.name}`, "hatsune"],
    ["walk-kiina", s => `キイナと巡る${s.name}`, "kiina"],
  ] },
  // PHASE 1 research themes: one per character's speciality, written from BoatStrikers' own confirmed results.
  // Each angle names a dataset (lib/blog/ai/data/datasets.mjs) and its period; the numbers come only from that
  // dataset after the data quality gate. The category slugs already exist in blog_categories (PHASE 1 seed).
  "inside-course": { name: "イン逃げ", perStadium: true, author: "ichika", requiresDocuments: false, research: true, angles: [
    ["escape-365", s => `${s.name}のイン逃げ率を直近1年の確定結果で検証`],
  ], datasets: { "escape-365": { definition: "inside_escape", days: 365 } } },
  beginner: { name: "初心者", perStadium: false, author: "ichika", requiresDocuments: false, research: true, angles: [
    ["escape-national-90", () => "初心者講座：全国のイン逃げ率を直近90日の確定結果で見る"],
  ], datasets: { "escape-national-90": { definition: "inside_escape", days: 90 } } },
  women: { name: "女子戦", perStadium: false, author: "hatsune", requiresDocuments: false, research: true, angles: [
    ["women-escape-national-90", () => "女子戦のイン逃げ率と決まり手を直近90日の確定結果で検証"],
  ], datasets: { "women-escape-national-90": { definition: "women_inside_escape", days: 90 } } },
  longshot: { name: "穴・5アタマ", perStadium: true, author: "kiina", requiresDocuments: false, research: true, angles: [
    ["boat5-365", s => `${s.name}の5号艇1着率を直近1年の確定結果で検証`],
    ["high-payout-365", s => `${s.name}で3連単1万円以上はどれくらい出る？直近1年の確定結果で検証`],
  ], datasets: { "boat5-365": { definition: "boat5_win", days: 365 }, "high-payout-365": { definition: "high_payout", days: 365 } } },
};

// The research categories, in the order of the daily character rotation (一果 → 初音 → キイナ).
export const RESEARCH_ROTATION = [
  { character: "ichika", categories: ["inside-course", "beginner"] },
  { character: "hatsune", categories: ["women"] },
  { character: "kiina", categories: ["longshot"] },
];

// The dataset an angle is written from (null for the stadium/charm themes, which use official pages).
export function datasetFor(categorySlug, angle) {
  return AI_CATEGORIES[categorySlug]?.datasets?.[angle] ?? null;
}

// The theme an angle is a variant of ("water-hatsune" → "water"): the same data and structure, another lead.
export function angleBase(categorySlug, angle) {
  return AI_CATEGORIES[categorySlug]?.angles.find(a => a[0] === angle)?.[3] ?? angle;
}

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
