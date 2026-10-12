import { AI_CATEGORIES, angleBase } from "./topics.mjs";
import { courseReadings } from "./dataReadings.mjs";

// How large an article may be and who appears in it, decided from the source pack before the AI writes.
// Few facts → a short article; the cast is the lead plus at most one partner suited to the theme.

// Facts that differ only by a number (1〜6コース1着率) are one kind of information.
export const factGroup = fact => String(fact.label).replace(/\d+/g, "#");

// Partners suited to a theme, in order of preference. When the data holds something unexpected outside (an outer
// course above the one inside it), キイナ, who looks for such finds, joins instead of the default.
// Keyed by the angle itself, so a variant led by another character ("water-hatsune") has its own partners.
const PARTNERS = {
  "stadium-basics": { course: ["hatsune", "kiina"], "water-hatsune": ["ichika"] },
  stadiums: { inside: [], outer: ["kiina"], "outer-kiina": ["ichika"] },
  "data-lab": { "inside-24": ["hatsune"] },
};
const FINDER = "kiina";
// In a dialogue 一果 explains how to read the data whenever she is in it; the other speaks first, in their own way
// (初音 asks a beginner's question, キイナ points out a find). Without 一果 the lead answers.
const EXPLAINER = "ichika";

const STRUCTURE = {
  // blog-ai-v10: the course theme puts the basics in the lead (see framing.basicsInLead), so it has no basics section;
  // the water theme is about the basics and keeps them as its first section.
  "stadium-basics": [
    "セクションの役割を分けます：①コース別1着率（定義・表・特徴）②読者が当日に確認すること。",
    "1つのセクションに1つの話題。同じ事実・同じ特徴を別のセクションで繰り返しません。",
    "データから言えないこと（展開・結果・理由）は書きません。",
  ],
  "stadium-basics:water": [
    "セクションの役割を分けます：①場の基本情報（水質・干満差・時間帯）②コース別1着率（定義・表・特徴。facts にある場合）③読者が当日に確認すること。",
    "①の基本情報と②のコース別1着率の統計を混ぜません。①には注意書きを入れません。",
    "1つのセクションに1つの話題。同じ事実・同じ特徴を別のセクションで繰り返しません。",
    "データから言えないこと（展開・結果・理由）は書きません。",
  ],
  "stadium-charm": [
    "documents に書かれている施設・歴史・グルメなどの事実だけで構成します。数値データや舟券の攻略は扱いません。",
    "documents にない魅力は想像で書かず、needs_check に回します。",
  ],
  stadiums: [
    "「攻略」は facts の数値から読み取れる確認ポイントに限ります。展開予想・買い目・選手評価は書きません。",
    "数値ごとに、何を示す指標か・集計期間・その数字だけでは分からないことを書きます。",
  ],
  "data-lab": [
    "各数値の集計期間と出典を明記し、並べて比較する以上の結論（原因・今後の傾向）は書きません。",
  ],
  characters: [
    "案内役のキャラクターの視点で、documents にある事実だけを紹介します。",
  ],
};

export function articlePlan(pack) {
  const category = AI_CATEGORIES[pack.topic.category_slug] || {};
  const lead = pack.topic.character_key || category.author || "ichika";
  const base = angleBase(pack.topic.category_slug, pack.topic.angle);
  const candidates = (PARTNERS[pack.topic.category_slug]?.[pack.topic.angle] ?? []).filter(c => c !== lead);
  const readings = pack.facts ? courseReadings(pack.facts) : [];
  const finding = readings.some(r => r.kind === "reversal");
  const partner = (finding && candidates.includes(FINDER) ? FINDER : candidates[0]) ?? null;
  const cast = partner ? [lead, partner] : [lead];
  // Who explains and who speaks first in a dialogue.
  const explainer = cast.includes(EXPLAINER) ? EXPLAINER : lead;
  const speaker = cast.find(c => c !== explainer) ?? null;
  // Who may appear without a note: the lead and any partner suited to the theme (drafts made before the partner
  // was chosen from the data keep theirs).
  const allowed = [lead, ...candidates];
  // Kinds of information available: fact groups for data articles, fetched documents for document-based ones.
  const groups = new Set((pack.facts || []).map(factGroup)).size + (category.requiresDocuments ? (pack.documents || []).length : 0);
  const maxBodyBlocks = Math.min(14, Math.max(5, Math.round(3 + groups * 1.5)));
  const sections = groups <= 2 ? { min: 2, max: 2 } : groups <= 4 ? { min: 2, max: 3 } : { min: 3, max: 5 };
  // Short articles carry no dialogue; others one (or two when there is much to read). A dialogue needs two
  // characters: with the lead alone there is none.
  const maxDialogues = cast.length < 2 || maxBodyBlocks <= 5 ? 0 : groups <= 4 ? 1 : 2;
  // Where each featured reading is told, once: in the body, or in the dialogue when that is what the partner is
  // there for (キイナ noticing an outer course above an inner one). With 初音 the dialogue takes a beginner's question
  // instead (frame number vs course), so every reading stays in the body.
  // How the article opens and closes (blog-ai-v7): the title states one featured reading, the lead asks about
  // another without giving it away, and the summary brings one or two back as what was found. Without an exception
  // (blog-ai-v11), 1コース below half and the inside-first order are what the stadium has to tell.
  const featured = kind => readings.find(r => r.featured && r.kind === kind) ?? null;
  const titleReading = featured("half") ?? featured("under_half") ?? featured("top") ?? readings.find(r => r.featured) ?? null;
  const hookReading = [featured("reversal"), featured("in_order"), featured("except_top"), featured("near")].find(r => r && r.key !== titleReading?.key) ?? null;
  // The same holds whoever leads: キイナ speaking first brings a find (an outer course above an inner one, else another
  // featured reading about the outer courses); 初音 speaking first asks a beginner's question about a reading the body
  // leaves to the dialogue (blog-ai-v11: never the 号艇/course difference, which the body and the DATA CHECK explain).
  let dialogueFocus = null;
  if (maxDialogues && speaker === FINDER) {
    // Without a reversal, the outer courses never rising above the inner ones is itself what she can point out.
    const find = readings.find(r => r.featured && r.kind === "reversal") ?? readings.find(r => r.featured && r.kind === "in_order")
      ?? readings.find(r => r.featured && /[3-6]/.test(r.key) && r.key !== "order");
    if (find) dialogueFocus = { kind: "reading", key: find.key, text: find.text };
  } else if (maxDialogues && speaker === "hatsune") {
    const asked = hookReading ?? readings.find(r => r.featured && r.key !== titleReading?.key);
    if (asked) dialogueFocus = { kind: "question", key: asked.key, text: asked.text };
  }
  const placements = Object.fromEntries(readings.filter(r => r.featured).map(r => [r.key, dialogueFocus?.key === r.key ? "dialogue" : "body"]));
  // Basic facts that fit in one sentence (水質・干満差…) go into the lead instead of a section of their own.
  const basics = (pack.facts || []).filter(f => !/コース1着率$/.test(f.label) && !f.period);
  const framing = {
    title: titleReading && { key: titleReading.key, text: titleReading.text },
    hook: hookReading && { key: hookReading.key, text: hookReading.text },
    summary: [titleReading, hookReading].filter(Boolean).map(r => ({ key: r.key, text: r.text })),
    // The water theme is about these basics, so they get their own section instead.
    basicsInLead: base !== "water" && readings.length > 0 && basics.length > 0 && basics.length <= 3,
  };
  return { lead, partner: cast[1] ?? null, cast, allowed, explainer, speaker, groups, maxBodyBlocks, sections, maxDialogues, dialogueFocus, placements, framing,
    structure: STRUCTURE[`${pack.topic.category_slug}:${base}`] || STRUCTURE[pack.topic.category_slug] || [] };
}
