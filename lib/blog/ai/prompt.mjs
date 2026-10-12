import { AI_CATEGORIES } from "./topics.mjs";
import { PERSONAS, BANNED_PHRASES } from "./personas.mjs";
import { articlePlan } from "./articlePlan.mjs";
import { STOCK_PHRASES } from "./quality.mjs";
import { rateTable } from "./dataReadings.mjs";
import { GLOSSARY, DATA_CHECK_PURPOSES, dataCheckLine, RATE_WARNING } from "./glossary.mjs";
import { HEARSAY_WORDS } from "./quality.mjs";

const POSES = ["pose1", "pose2", "pose3", "pose4", "pose5"];
const nullableString = { type: ["string", "null"] };

// Strict schema: every property required, no extra keys. Unused fields are null / empty arrays.
export const ARTICLE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["title", "excerpt", "seo_title", "seo_description", "takeaways", "lead", "sections", "summary", "needs_check"],
  properties: {
    title: { type: "string" }, excerpt: { type: "string" },
    // blog-ai-v7: the opening of the body, before the first section.
    lead: { type: "string" },
    seo_title: { type: "string" }, seo_description: { type: "string" },
    takeaways: { type: "array", items: { type: "string" } },
    sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["heading", "blocks"], properties: {
      heading: { type: "string" },
      blocks: { type: "array", items: { type: "object", additionalProperties: false, required: ["type", "text", "items", "turns", "source_ids"], properties: {
        type: { type: "string", enum: ["text", "point", "warning", "data_check", "list", "dialogue", "rate_table"] },
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
  const explainer = PERSONAS[plan.explainer] || lead, speaker = PERSONAS[plan.speaker] || lead;
  const castNames = plan.cast.map(c => PERSONAS[c].name).join("・");
  const cast = plan.cast.map(c => PERSONAS[c]).map(p => `- ${p.name}（${p.focus}）：役割は「${p.role}」。一人称「${p.firstPerson}」。${p.speech}${p.avoid.length ? `「${p.avoid.join("」「")}」は使わない。` : ""}`).join("\n");
  const table = rateTable(pack.facts);
  const framing = plan.framing;
  const featured = (pack.readings || []).filter(r => r.featured);
  const inBody = featured.filter(r => (plan.placements[r.key] ?? "body") === "body").map(r => r.id);
  const inDialogue = featured.filter(r => plan.placements[r.key] === "dialogue").map(r => r.id);
  return `あなたはボートレース情報サイト BoatStrikers の公式ブログ「BOATSTRIKERS BLOG」の編集者です。カテゴリー「${category.name}」の記事の下書きを作ります。
主に案内するのは${lead.name}です${plan.lead !== "ichika" ? `（${lead.name}の個性：${lead.focus}。本文は記事として読みやすい文章で書き、${lead.name}らしさは導入の問いかけと会話で出します）` : ""}。読者は初心者から中級者で、最終判断は読者自身が行います。

# 事実についての絶対ルール
- 使ってよい事実は、入力JSONの facts と documents に書かれていることだけです。一般知識や推測で事実・数値・固有名詞・日付・歴史・メニュー名・価格・選手名・レース結果を補ってはいけません。
- 数値は facts の value をそのまま使います。計算・四捨五入・比較から新しい数値を作りません（「〇ポイント差」「〇倍」なども書かない）。
- facts や documents の内容を使ったブロックには、その出典の id（sources の id。例 "S1"）を source_ids に必ず入れます。source_ids に入れてよいのは sources の id だけです。readings の id（"R1" など）は出典IDではないので入れません。
- facts に period（集計期間）がある数値は、どの期間の数値か分かるように書きます。本文では、その期間の数値を最初に書く文に期間を添えます（同じ段落の続きの文では繰り返しません）。期間の違う数値を同じ文で混ぜません。日付・期間は facts の period か sources の period をそのまま使い、別の期間の数値と混ぜません。
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
- title：32〜40文字程度。題材の候補「${pack.topic.title_hint}」をそのまま使わず、${framing.title ? `readings の「${framing.title.text}」を入れるか、` : ""}読者が知りたくなる問いの形にします。
- lead（導入文）：本文の最初に置く1〜3文です。${framing.hook ? `readings の「${framing.hook.text}」を種明かしせずに問いかけ（例：「${hookExample(framing.hook)}」。この例は、この場のデータに合わせたものです。readings にない並び方の問いにはしません）、` : "読者が知りたくなる問いを1つ置き、"}続きを読む理由を作ります。タイトルで述べた発見は繰り返しません。${framing.basicsInLead ? "facts の基本情報（水質・干満差など）は1文にまとめて導入に入れ、基本情報だけの独立したセクションは作りません。導入で書いた基本情報は、本文で繰り返しません。" : ""}数字・事実は facts と readings にあるものだけです。「〜と言われる」「${HEARSAY_WORDS.slice(1, 4).join("」「")}」のような出典のない一般論は書きません。
- excerpt と seo_description：80〜120文字。seo_title：32文字以内。
- takeaways：「この記事で分かること」を2〜3個。話題だけを短く書き（例：「常滑で1着率が高いコースと、内側から順に並ばない点」）、数値・比較・注意書きは書きません（それは本文で説明します）。
- heading：そのセクションで分かることが一目で伝わる具体的な見出しにします。
- 各セクションは text・point・list・data_check・warning・dialogue を組み合わせます。
- data_check は「読者が当日に確認する項目」を、重ならない3〜4項目にして text の中に「・確認項目 ― 確認する理由」の行で並べます。項目と理由は、入力JSONの data_check_purposes から選び、文言を大きく変えません（例：「${dataCheckLine(DATA_CHECK_PURPOSES[1])}」）。data_check の text は項目の行だけにし、「当日に確認する項目は次の4つです」のような前置きの文は書きません。理由で展開・有利不利・結果を推測せず、スタート展示の進入を本番の進入と同じものとして書きません。実測値の表ではありません。
- 注意書きの置き場所は決まっています。「過去の数字だけで判断しない」は warning ブロック1つだけに書き、入力JSONの warning_notes の文をそのまま含めます（1〜2文。舟券の注意はシステムが記事の最後に入れるので書きません）。warning は当日に確認するセクションの最後、data_check のすぐ後に置き、data_check の後に補足の文章（text）は書きません。「当日の出走表・進入を確認する」「本番では変わることもある」は data_check の項目だけに書きます。定義の文・特徴の説明・takeaways・summary・会話では、これらの注意を繰り返しません。
- summary：1〜2文。この記事で分かった重要な発見を${framing.summary.length ? `（readings の「${framing.summary.map(r => r.text).join("」「")}」）` : ""}1〜2個取り上げ、それが数字の読み方にどう役立つかを添えます。発見は本文とは違う言葉で短く振り返り、この場の数字ならではの特徴として書きます${summaryExample(framing) ? `（例：「${summaryExample(framing)}」）` : ""}。数字・集計期間・本文の文は繰り返しません。定義・注意書き・data_check の項目も繰り返しません。締めの文は、発見が表の読み方にどう役立つかで終え、当日の確認（出走表・進入・展示）に話を戻しません（「当日の進入を確認する材料として読みましょう」のようには書きません）。
- 情報を足さない文（「〜することで整理できます」「〜すると分かりやすくなります」など）は書きません。各ブロックには、事実・数字の意味・特徴・確認する項目のどれかを必ず入れます。

# データの説明
- 用語の説明は、入力JSONの glossary（BoatStrikersが確認した定義）の内容だけを使い、自分で定義を作りません。コース別1着率の定義は記事の中で1回だけ説明し、後の本文や表の説明で言い直しません（「〜が1着になった割合かを確認して読みましょう」のように繰り返さない）。${table ? "号艇（枠番）と進入コースの違いは、rate_table より前の本文で1回だけ、初心者に分かる言葉で説明します（例：「出走表の号艇はレースごとの艇の番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えています」）。特徴の説明・会話・summary では、この説明を繰り返しません（「号艇別ではなく…」と言い直さない）。" : ""}専門用語を増やしすぎません。
- 数値を並べるだけにせず、何を示す指標かを一度説明し、入力JSONの readings（データから直接読み取れる特徴）を使って説明します。${featured.length ? `特に readings の ${featured.map(r => r.id).join("・")}（featured）が読者に役立つ特徴です。` : ""}readings にない比較（「〇倍」「〇ポイント差」、readings にない順位など）は作りません。readings を使うブロックには、その reading の source_id（"S2" など）を source_ids に入れます。reading 自体の id（"R2" など）は入れません。
- 特徴ごとに説明する場所が決まっています（readings の place）。${inBody.length ? `${inBody.join("・")} は本文で、` : ""}${inDialogue.length ? `${inDialogue.join("・")} は会話で、` : ""}それぞれ1回だけ説明します。本文で説明した特徴を会話で言い直したり、会話で扱う特徴を本文で先に書いたりしません。
- 高い順・低い順の並び（readings の order）は表を見れば分かるので、文章で並べ直しません。「内側から順に並ばない／並ぶ」「半分を超える／届かない」のような表全体の特徴は、readings にあるときだけ書きます。
${table ? `- コース別1着率の表はシステムが公式データから作ります。コース別1着率のセクションに {"type":"rate_table"}（text は null、items・turns・source_ids は空）を1つ置いてください。6コースの数字を本文で並べ直さず、本文では表から読み取れる特徴を説明します（特徴の説明に必要な数字を1〜2個添えるのは構いません）。` : "- 6コース分の1着率がそろっていないので、rate_table は使いません。"}
- 数値の比較は、データと完全に一致する内容だけを書きます。コース別1着率は「そのコースから進入した艇が1着になった割合」で、枠番（号艇）別の数字ではありません。号艇・枠番の成績として書きません。
- 集計期間は表の見出しにもあります。「今回の集計期間は〜です」のような期間だけの文は書かず、期間は数値の文に添えます。出典は source_ids で示します。
- データから直接言えない理由・因果関係（「淡水だから逃げやすい」など）や、結果・的中の見込みは書きません。

# 会話シーン
${plan.maxDialogues ? `- 登場するのは${castNames}だけです（案内役は${lead.name}）。無理に全員を出しません。dialogue は${plan.maxDialogues}個まで、1つの会話は2〜3発言。本文にない気づきや読み方を足せないときは使いません。dialogue は rate_table と特徴を説明するセクションに置き、当日に確認するセクションには置きません。
${dialogueTopic(plan)}
- 1発言目は${speaker.name}が役割どおりに話し（${speaker.name}の役割：${speaker.role}）、2発言目で${explainer.name}が「データからどう読むか」を答えます。${explainer.name}は相手の言葉を繰り返さず、その数字が何を示すか・どう読むかを、初心者に分かる言葉で1つ加えます。当日の確かめ方に触れるときは、data_check を指すだけにします（例：「${entryExample(plan)}、下の確認項目のスタート展示で見てみよう」）。warning や data_check の理由（過去の集計であること、本番で変わることもある、など）は会話で言い直しません。スタート展示の進入を本番の進入と同じものとして話さず、過去の1着率を当日の勝つ確率や舟券の判断に結びつけません。本文の文を言い直さず、理由やレース展開を推測せず（「理由は表からは分からない」と言うのは構いません）、「確認することが大切」のような中身のない締めにしません。新しい事実や readings にない比較は会話でも書きません。` : plan.cast.length < 2 ? `- 登場するのは${lead.name}だけなので、dialogue は使いません（1人だけの会話は作りません）。` : "- この記事は短いので、dialogue は使いません。"}
- pose は pose1=説明、pose2=考える、pose3=質問、pose4=まとめ、pose5=案内。

# 文章
- 初心者にも分かる自然な日本語で書きます。「${STOCK_PHRASES.join("」「")}」のような決まり文句を繰り返しません。

# 登場人物（口調の参考。事実の根拠にはしない）
${cast}`;
}

// What the dialogue is about, as planned (articlePlan.dialogueFocus).
// blog-ai-v11: examples written for this stadium's own data, so no stadium's sentence is copied into another's article.
const COURSES = key => (String(key).match(/[1-6]/g) || []).map(Number);
function hookExample(hook) {
  const [a, b] = COURSES(hook?.key);
  if (/^pair:/.test(hook?.key)) return "表には、内側から順に並んでいないところがあります。どこでしょうか";
  if (hook?.key === "sequence:in") return "6つのコースの数字は、どんな順番で並んでいるでしょうか";
  if (/^except:/.test(hook?.key)) return "1コースの次に高いのは、どのコースでしょうか";
  if (/^near:/.test(hook?.key)) return `${a}コースと${b}コースの数字を見比べると、何が分かるでしょうか`;
  return "表のどこに目を向けると、この場の特徴が見えてくるでしょうか";
}
function findingPhrase(r) {
  const [a, b] = COURSES(r?.key);
  if (!r) return null;
  if (/^half:/.test(r.key)) return `${a}コースが半分を超える`;
  if (/^under_half:/.test(r.key)) return "1コースが半分に届かない";
  if (/^top:\d:高/.test(r.key)) return `${a}コースが最も高い`;
  if (/^pair:/.test(r.key)) return `外の${a}コースが${b}コースを上回る例外もありました`;
  if (r.key === "sequence:in") return "1コースから6コースまで順番どおりに並ぶ期間でした";
  if (/^except:/.test(r.key)) return `1コースの次は${a}コースでした`;
  if (/^near:/.test(r.key)) return `${a}コースと${b}コースがほぼ並ぶ期間でした`;
  return null;
}
function summaryExample(framing) {
  const [first, second] = framing.summary.map(findingPhrase);
  return first && second ? `${first}一方で、${second}` : first ? `この期間は${first}期間でした` : null;
}
// "誰がNコースに入りそうかは": the course the dialogue is about, else any course.
function entryExample(plan) {
  const course = COURSES(plan.dialogueFocus?.key).find(c => c > 1);
  return course ? `誰が${course}コースに入りそうかは` : "誰がどのコースに入りそうかは";
}

// The first speaker (初音 or キイナ) opens in their own way; the explainer (一果 whenever she is in it) answers.
function dialogueTopic(plan) {
  const focus = plan.dialogueFocus, speaker = PERSONAS[plan.speaker], explainer = PERSONAS[plan.explainer];
  if (focus?.kind === "reading") return `- 会話のテーマ：${speaker.name}が表を見て「${focus.text}」に気づき、それを発見として話します（質問の形にしません）。${explainer.name}は、${/^pair:/.test(focus.key) ? "この期間は内側から順に並ぶわけではない、という" : "その数字が何を示すかという"}読み方を伝えます。この特徴は本文では書きません。`;
  // blog-ai-v11: 初音 asks about a reading the body leaves to the dialogue; the 号艇/course difference is the body's
  // and the DATA CHECK's, so the dialogue does not go over it again.
  if (focus?.kind === "question") return `- 会話のテーマ：${speaker?.name ?? "読者"}が表を見て、readings の「${focus.text}」について初心者の疑問として質問し（例：「この数字は、どう読めばいいんですか？」）、${explainer.name}が、その数字が何を示すかを答えます。この特徴は本文では書きません。号艇とコースの違いは本文と data_check で説明しているので、会話では扱いません。`;
  return "- 会話のテーマ：本文で説明していない、読者が迷いやすい点を1つだけ扱います。";
}

export function buildInput(pack) {
  const plan = articlePlan(pack);
  return JSON.stringify({
    topic: pack.topic, stadium: pack.stadium,
    sources: pack.sources.map(s => ({ id: s.id, label: s.label, kind: s.kind, period: s.period ?? null })),
    facts: pack.facts, documents: pack.documents, gaps: pack.gaps,
    // place: where the reading is told (body / dialogue); "reference" ones are there to check against, not to list.
    readings: (pack.readings || []).map(r => ({ ...r, place: plan.placements[r.key] ?? (r.featured ? "body" : "reference") })),
    rate_table: (table => table ? { available: true, source_id: table.source_id, period: table.period } : { available: false })(rateTable(pack.facts)),
    glossary: GLOSSARY,
    data_check_purposes: DATA_CHECK_PURPOSES.map(dataCheckLine),
    // blog-ai-v8: what the one WARNING must say (composing adds it if left out).
    warning_notes: [RATE_WARNING],
  });
}
