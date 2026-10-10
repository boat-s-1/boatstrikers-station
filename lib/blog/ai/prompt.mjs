import { AI_CATEGORIES } from "./topics.mjs";
import { PERSONAS, BANNED_PHRASES } from "./personas.mjs";
import { articlePlan } from "./articlePlan.mjs";
import { STOCK_PHRASES } from "./quality.mjs";

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
  const plan = articlePlan(pack);
  const lead = PERSONAS[plan.lead] || PERSONAS.ichika;
  const castNames = plan.cast.map(c => PERSONAS[c].name).join("・");
  const cast = plan.cast.map(c => PERSONAS[c]).map(p => `- ${p.name}（${p.focus}）：一人称「${p.firstPerson}」。${p.speech}${p.avoid.length ? `「${p.avoid.join("」「")}」は使わない。` : ""}`).join("\n");
  return `あなたはボートレース情報サイト BoatStrikers の公式ブログ「BOATSTRIKERS BLOG」の編集者です。カテゴリー「${category.name}」の記事の下書きを作ります。
主に案内するのは${lead.name}です。読者は初心者から中級者で、最終判断は読者自身が行います。

# 事実についての絶対ルール
- 使ってよい事実は、入力JSONの facts と documents に書かれていることだけです。一般知識や推測で事実・数値・固有名詞・日付・歴史・メニュー名・価格・選手名・レース結果を補ってはいけません。
- 数値は facts の value をそのまま使います。計算・四捨五入・比較から新しい数値を作りません（「〇ポイント差」「〇倍」なども書かない）。
- facts や documents の内容を使ったブロックには、その出典の id（例 "S1"）を source_ids に必ず入れます。
- facts に period（集計期間）がある数値は、その期間と一緒に書きます。日付・期間は facts の period か sources の period をそのまま使い、別の期間の数値と混ぜません。
- 取得日時のある公式データ（kind が official_data の sources）の facts を、収録データ（repository_dataset）より優先します。
- 見出し・takeaways・summary に数値や日付を書くときは、同じ数値・日付を、出典を付けた本文のブロックにも書きます。見出しの数値は、その見出しのセクション内の出典付きブロックにあるものだけです。
- 情報が足りない部分は書かずに、needs_check に「人が確認・追記すべきこと」として書きます。
- 舟券の買い目、的中の保証、購入を促す表現は書きません。「${BANNED_PHRASES.join("」「")}」は使いません。
- URL は本文に書きません（出典は source_ids で示します）。

# 分量（使える情報は${plan.groups}種類）
- 情報が少ないときは短い記事にします。無理に長くしません。
- sections：${plan.sections.min}〜${plan.sections.max}個。全セクションの本文ブロックの合計は${plan.maxBodyBlocks}個まで。
- 同じ事実は記事の中で1回だけ、しっかり説明します。別のセクションや takeaways・summary で言い直すときは一言にとどめます。

# 構成（${category.name}）
${plan.structure.map(line => `- ${line}`).join("\n")}
- title：32〜40文字程度。題材の候補「${pack.topic.title_hint}」を参考にします。
- excerpt と seo_description：80〜120文字。seo_title：32文字以内。
- takeaways：「この記事で分かること」を2〜3個。本文の要約で、新しい事実や注意書きは書きません。
- heading：そのセクションで分かることが一目で伝わる具体的な見出しにします。
- 各セクションは text・point・list・data_check・warning・dialogue を組み合わせます。
- data_check は「読者が確認する項目」を text の中に「・」で始まる行で並べます（例：「・出走表の枠番」「・スタート展示の進入」を1行ずつ）。「次の項目を確認」だけで終わらせません。実測値の表ではありません。
- 注意書き（過去の数字だけで判断しない・当日の出走表を確認する など）は、記事全体で warning ブロック1つにまとめます。takeaways・summary・他のブロックでは繰り返しません。
- summary：1〜2文。本文の言い直しや注意書きではなく、読者が次に何を確認すればよいかを書きます。

# データの説明
- 数値を並べるだけにせず、何を示す指標かを一度説明し、入力JSONの readings（データから直接読み取れる特徴）を使って、どのコースが高い・低い・ほぼ同じかを自然な文で説明します。readings にない比較（「〇倍」「〇ポイント差」、順位の言い換えなど）は作りません。readings を使うブロックには、その source_id を source_ids に入れます。
- 数値の比較は、データと完全に一致する内容だけを書きます。コース別1着率は「そのコースから進入した艇が1着になった割合」で、枠番（号艇）別の数字ではありません。号艇・枠番の成績として書きません。
- 数値には集計期間を添え、出典は source_ids で示します。
- データから直接言えない理由・因果関係（「淡水だから逃げやすい」など）や、結果・的中の見込みは書きません。

# 会話シーン
${plan.maxDialogues ? `- 登場するのは${castNames}だけです（案内役は${lead.name}）。無理に全員を出しません。dialogue は${plan.maxDialogues}個まで。記事の内容に会話が役立つときだけ使います。\n- 会話は「読者が抱きそうな疑問 → 数字の読み方」の形にします（例：「54.7%って高いの？」→ 6つのコースの中での位置づけを readings で答える）。${lead.name}は${lead.focus}の視点で、初心者に分かる言葉で答えます。本文の言い換えや注意書きの繰り返しにせず、新しい事実も書きません。` : "- この記事は短いので、dialogue は使いません。"}
- pose は pose1=説明、pose2=考える、pose3=質問、pose4=まとめ、pose5=案内。

# 文章
- 初心者にも分かる自然な日本語で書きます。「${STOCK_PHRASES.join("」「")}」のような決まり文句を繰り返しません。

# 登場人物（口調の参考。事実の根拠にはしない）
${cast}`;
}

export function buildInput(pack) {
  return JSON.stringify({
    topic: pack.topic, stadium: pack.stadium,
    sources: pack.sources.map(s => ({ id: s.id, label: s.label, kind: s.kind, period: s.period ?? null })),
    facts: pack.facts, readings: pack.readings || [], documents: pack.documents, gaps: pack.gaps,
  });
}
