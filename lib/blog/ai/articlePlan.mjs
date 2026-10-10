import { AI_CATEGORIES } from "./topics.mjs";

// How large an article may be and who appears in it, decided from the source pack before the AI writes.
// Few facts → a short article; the cast is the lead plus at most one partner suited to the theme.

// Facts that differ only by a number (1〜6コース1着率) are one kind of information.
export const factGroup = fact => String(fact.label).replace(/\d+/g, "#");

const PARTNER = {
  "stadium-basics": { course: "hatsune" },
  stadiums: { inside: null, outer: "kiina" },
  "data-lab": { "inside-24": "hatsune" },
};

const STRUCTURE = {
  "stadium-basics": [
    "公式データで確認できる基本情報（水質・干満差・コース別1着率など）を、何を示す数字かの説明と一緒に整理します。",
    "1つのセクションに1つの話題。同じ事実を別のセクションで繰り返しません。",
    "最後のセクションは「読者が当日に確認すること」。データから言えないこと（展開・結果）は書きません。",
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
  const partner = PARTNER[pack.topic.category_slug]?.[pack.topic.angle] ?? null;
  const cast = partner && partner !== lead ? [lead, partner] : [lead];
  // Kinds of information available: fact groups for data articles, fetched documents for document-based ones.
  const groups = new Set((pack.facts || []).map(factGroup)).size + (category.requiresDocuments ? (pack.documents || []).length : 0);
  const maxBodyBlocks = Math.min(14, Math.max(5, Math.round(3 + groups * 1.5)));
  const sections = groups <= 2 ? { min: 2, max: 2 } : groups <= 4 ? { min: 2, max: 3 } : { min: 3, max: 5 };
  // Short articles carry no dialogue; others one (or two when there is much to read).
  const maxDialogues = maxBodyBlocks <= 5 ? 0 : groups <= 4 ? 1 : 2;
  return { lead, partner: cast[1] ?? null, cast, groups, maxBodyBlocks, sections, maxDialogues,
    structure: STRUCTURE[pack.topic.category_slug] || [] };
}
