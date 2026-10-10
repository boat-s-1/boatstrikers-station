import { AI_CATEGORIES } from "./topics.mjs";
import { courseReadings } from "./dataReadings.mjs";

// How large an article may be and who appears in it, decided from the source pack before the AI writes.
// Few facts → a short article; the cast is the lead plus at most one partner suited to the theme.

// Facts that differ only by a number (1〜6コース1着率) are one kind of information.
export const factGroup = fact => String(fact.label).replace(/\d+/g, "#");

// Partners suited to a theme, in order of preference. When the data holds something unexpected outside (an outer
// course above the one inside it), キイナ, who looks for such finds, joins instead of the default.
const PARTNERS = {
  "stadium-basics": { course: ["hatsune", "kiina"] },
  stadiums: { inside: [], outer: ["kiina"] },
  "data-lab": { "inside-24": ["hatsune"] },
};
const FINDER = "kiina";

const STRUCTURE = {
  "stadium-basics": [
    "セクションの役割を分けます：①場の基本情報（水質・干満差・時間帯）②コース別1着率（定義・表・特徴）③読者が当日に確認すること。",
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
  const candidates = (PARTNERS[pack.topic.category_slug]?.[pack.topic.angle] ?? []).filter(c => c !== lead);
  const finding = (pack.facts ? courseReadings(pack.facts) : []).some(r => r.kind === "reversal");
  const partner = (finding && candidates.includes(FINDER) ? FINDER : candidates[0]) ?? null;
  const cast = partner ? [lead, partner] : [lead];
  // Who may appear without a note: the lead and any partner suited to the theme (drafts made before the partner
  // was chosen from the data keep theirs).
  const allowed = [lead, ...candidates];
  // Kinds of information available: fact groups for data articles, fetched documents for document-based ones.
  const groups = new Set((pack.facts || []).map(factGroup)).size + (category.requiresDocuments ? (pack.documents || []).length : 0);
  const maxBodyBlocks = Math.min(14, Math.max(5, Math.round(3 + groups * 1.5)));
  const sections = groups <= 2 ? { min: 2, max: 2 } : groups <= 4 ? { min: 2, max: 3 } : { min: 3, max: 5 };
  // Short articles carry no dialogue; others one (or two when there is much to read).
  const maxDialogues = maxBodyBlocks <= 5 ? 0 : groups <= 4 ? 1 : 2;
  return { lead, partner: cast[1] ?? null, cast, allowed, groups, maxBodyBlocks, sections, maxDialogues,
    structure: STRUCTURE[pack.topic.category_slug] || [] };
}
