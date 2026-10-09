import { AI_CATEGORIES } from "./topics.mjs";
import { PERSONAS, BANNED_PHRASES } from "./personas.mjs";

const POSES = ["pose1", "pose2", "pose3", "pose4", "pose5"];
const nullableString = { type: ["string", "null"] };

// Strict schema: every property required, no extra keys. Unused fields are null / empty arrays.
export const ARTICLE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["title", "excerpt", "seo_title", "seo_description", "takeaways", "sections", "summary", "needs_check"],
  properties: {
    title: { type: "string" }, excerpt: { type: "string" },
    seo_title: { type: "string" }, seo_description: { type: "string" },
    takeaways: { type: "array", items: { type: "string" } },
    sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["heading", "blocks"], properties: {
      heading: { type: "string" },
      blocks: { type: "array", items: { type: "object", additionalProperties: false, required: ["type", "text", "items", "turns", "source_ids"], properties: {
        type: { type: "string", enum: ["text", "point", "warning", "data_check", "list", "dialogue"] },
        text: nullableString,
        items: { type: "array", items: { type: "string" } },
        turns: { type: "array", items: { type: "object", additionalProperties: false, required: ["character", "pose", "text"], properties: {
          character: { type: "string", enum: Object.keys(PERSONAS) }, pose: { type: "string", enum: POSES }, text: { type: "string" },
        } } },
        source_ids: { type: "array", items: { type: "string" } },
      } } },
    } } },
    summary: { type: "string" },
    needs_check: { type: "array", items: { type: "string" } },
  },
};

export function buildInstructions(pack) {
  const category = AI_CATEGORIES[pack.topic.category_slug];
  const lead = PERSONAS[pack.topic.character_key] || PERSONAS[category.author] || PERSONAS.ichika;
  const cast = Object.values(PERSONAS).map(p => `- ${p.name}（${p.focus}）：一人称「${p.firstPerson}」。${p.speech}${p.avoid.length ? `「${p.avoid.join("」「")}」は使わない。` : ""}`).join("\n");
  return `あなたはボートレース情報サイト BoatStrikers の公式ブログ「BOATSTRIKERS BLOG」の編集者です。カテゴリー「${category.name}」の記事の下書きを作ります。
主に案内するのは${lead.name}です。読者は初心者から中級者で、最終判断は読者自身が行います。

# 事実についての絶対ルール
- 使ってよい事実は、入力JSONの facts と documents に書かれていることだけです。一般知識や推測で事実・数値・固有名詞・日付・歴史・メニュー名・価格・選手名・レース結果を補ってはいけません。
- 数値は facts の value をそのまま使います。計算・四捨五入・比較から新しい数値を作りません（「〇ポイント差」「〇倍」なども書かない）。
- facts や documents の内容を使ったブロックには、その出典の id（例 "S1"）を source_ids に必ず入れます。
- 情報が足りない部分は書かずに、needs_check に「人が確認・追記すべきこと」として書きます。
- 舟券の買い目、的中の保証、購入を促す表現は書きません。「${BANNED_PHRASES.join("」「")}」は使いません。
- URL は本文に書きません（出典は source_ids で示します）。

# 構成
- title：32〜40文字程度。題材の候補「${pack.topic.title_hint}」を参考にします。
- excerpt と seo_description：80〜120文字。seo_title：32文字以内。
- takeaways：「この記事で分かること」を2〜4個。
- sections：3〜5個。heading は具体的に。各セクションは text・point・list・data_check・warning・dialogue を組み合わせます。
- dialogue は1記事に1〜2個まで。登場人物は一果・初音・キイナだけ。pose は pose1=説明、pose2=考える、pose3=質問、pose4=まとめ、pose5=案内。
- data_check は「読者が確認する項目」の箇条書きで、実測値の表ではありません。
- summary：まとめを2〜3文。

# 登場人物（口調の参考。事実の根拠にはしない）
${cast}`;
}

export function buildInput(pack) {
  return JSON.stringify({
    topic: pack.topic, stadium: pack.stadium,
    sources: pack.sources.map(s => ({ id: s.id, label: s.label, kind: s.kind, period: s.period ?? null })),
    facts: pack.facts, documents: pack.documents, gaps: pack.gaps,
  });
}
