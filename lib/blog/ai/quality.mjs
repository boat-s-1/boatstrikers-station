import { articlePlan } from "./articlePlan.mjs";
import { PERSONAS } from "./personas.mjs";
import { claimsIn, norm } from "./claims.mjs";
import { comparisonMismatches, courseRateTables, dialogueContext, rateStatements, tableMismatches } from "./dataReadings.mjs";

// Readability and structure checks for AI drafts. They are warnings for the reviewer (the approval rules of
// validate.mjs are unchanged), except mislabelling course rates as frame (号艇) rates, which states a wrong fact.

// Stock phrases that read as filler when repeated.
export const STOCK_PHRASES = ["判断材料", "参考にしてください", "確認しましょう", "押さえておきましょう", "チェックしておきましょう", "入口", "整理できます", "ポイントです"];
// Generic fact values that say nothing on their own; the label is used to find mentions instead.
const GENERIC_VALUES = new Set(["なし", "あり", "有", "無"]);
const CAUSAL = /(淡水|海水|汽水|干満差|ナイター|水質|水面|1コース1着率)[^。！？]{0,24}(から|ため|ので|によって|により)[^。！？]{0,24}(有利|不利|勝ちやす|逃げやす|荒れやす|決まりやす|狙い目|当たりやす)/;
const FRAME_RATE = /([1-6１-６])\s*(号艇|枠)(の|は|が|で)?[^。、！？]{0,12}?(1着率|勝率|1着)/;
const EXPLAINS_RATE = /(割合|そのコースから|進入した(コース|艇)|1着になった|1着を取った)/;
// Sentences that deny a cause or a certainty are disclaimers, not causal claims.
const NEGATED = /(できません|できない|ではありません|ではない|言えません|言えない|わかりません|分かりません|断定しない|決めつけ|とは限りません|とは限らない|わけではありません|わけではない)/;
// Reader caveats that belong in one place only.
const CAVEATS = [
  ["過去の数字だけで判断しない", /(過去の(数字|割合|集計|データ|1着率)|集計値|この数字)[^。！？]{0,40}(判断|決め|断定|示すものではない|示す数字ではない|示すものではありません|示す数字ではありません)|(結果|展開)を(示す|保証する)(もの|数字)では(ありません|ない)|(結果|展開)を(断定|決めつけ)|決めつけ/],
  ["当日の出走表・進入を確認する", /当日[^。！？]{0,30}(出走表|進入|展示|直前情報|公式情報|開催条件)[^。！？]{0,30}(確認|確かめ|見て|見比べ|あわせて)/],
];
// Where each caveat belongs: the past-data caveat in the one WARNING, the day-of checks in the DATA CHECK.
const CAVEAT_HOME = { "過去の数字だけで判断しない": ["WARNING"], "当日の出走表・進入を確認する": ["DATA_CHECK", "WARNING"] };
// A sentence that only says reading helps ("…することで整理できます") adds nothing for the reader.
const FILLER = /(ことで|すると|見ると|分けると|比べると|押さえると)[^。！？]{0,30}(できます|なります|分かります|わかります|やすくなります|にくくなります)$/;
const DAY_ITEMS = /(出走表|展示|進入|モーター|選手|風|波|気象|オッズ)/;
const QUESTION = /(？|\?|ですか|でしょうか|の？|かな？|ますか)/;
const OUTSIDE = /([3-6]コース|外|意外|逆転|穴)/;
const COMPARES = /(最も|一番|いちばん|もっとも|高い|低い|上回|下回|ほぼ同じ|続く|次いで|半分を超え)/;
const LEAD_IN = /(次の|以下の)(項目|点|こと|ポイント)|[:：]\s*$/;
const RATE_FACT = /コース1着率$/;

// The sentence quotes this rate ("14.4%" does not quote "4.4%").
const quotes = (text, value) => new RegExp(`(?<![\\d.])${value.replace(".", "\\.")}%`).test(norm(text));
const plain = text => norm(text).replace(/[\s「」『』（）()、。・：:！？!?]/g, "");
function bigrams(text) {
  const s = plain(text), out = new Map();
  for (let i = 0; i < s.length - 1; i++) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) || 0) + 1);
  return out;
}
// Dice coefficient over character bigrams: 1 = same wording, around 0.6 = the same sentence lightly reworded.
export function similarity(a, b) {
  const x = bigrams(a), y = bigrams(b);
  let shared = 0, total = 0;
  for (const [k, n] of x) { shared += Math.min(n, y.get(k) || 0); total += n; }
  for (const n of y.values()) total += n;
  return total ? (2 * shared) / total : 0;
}
const sentences = text => norm(text).split(/[。！？!?\n]/).map(s => s.trim()).filter(s => plain(s).length >= 15);

// Words that show an article mentions a fact: the number itself, or a non-generic value and the label's topic.
function factKeywords(fact, stadiumName) {
  const value = norm(fact.value).trim(), topic = norm(fact.label).replace(stadiumName ? `${stadiumName}の` : "", "");
  if (/^\d+(\.\d+)?$/.test(value)) return [value];
  return [...new Set([GENERIC_VALUES.has(value) ? null : value, topic.replace(/の?(レース)?時間帯$/, "").length >= 2 ? topic : null].filter(Boolean))];
}

function blockTexts(b) {
  if (b.type === "DIALOGUE_SCENE") return b.data.turns.map(t => t.text);
  if (b.type === "LIST") return b.data.items || [];
  if (b.type === "TABLE") return (b.data.rows || []).flat();
  return [b.data?.text ?? ""];
}

const COURSE_WORDS = { 高: "高い", 低: "低い" };
// "pair:4>3" → "4コース＞3コース" for messages.
function readable(key) {
  const [kind, a, b] = key.split(":");
  if (kind === "pair") return a.replace(">", "コース＞") + "コース";
  if (kind === "top") return `${a}コースが最も${COURSE_WORDS[b]}`;
  if (kind === "except") return `1コース以外で${a}コースが最も${COURSE_WORDS[b]}`;
  if (kind === "half") return `${a}コースが半分超え`;
  if (kind === "near") return `${a}コースと${b}コースがほぼ同じ`;
  if (kind === "ordinal") return `${a}コースが${b}番目`;
  return key;
}

export function qualityIssues({ document, pack }) {
  const plan = articlePlan(pack);
  const issues = [];
  const warn = (code, message) => issues.push({ level: "warning", code, message });
  const where = i => `ブロック${i + 1}（${document.blocks[i].type}）`;
  const blocks = document.blocks.map((b, i) => ({ b, i, text: blockTexts(b).join("\n") })).filter(x => !x.b.data?.system);
  const body = blocks.filter(x => x.b.type !== "HEADING" && !x.b.data?.placement);
  const all = [document.title, document.excerpt, ...blocks.map(x => x.text)].join("\n");

  // 1. The same sentence (or a light rewording of it) in two places of the body.
  const pairs = [];
  for (let a = 0; a < body.length; a++) for (let c = a + 1; c < body.length; c++) {
    if (body[a].b.type === "DIALOGUE_SCENE" || body[c].b.type === "DIALOGUE_SCENE") continue;
    if (sentences(body[a].text).some(s => sentences(body[c].text).some(t => similarity(s, t) >= 0.6))) pairs.push(`${where(body[a].i)}と${where(body[c].i)}`);
  }
  if (pairs.length) warn("repeated_content", `ほぼ同じ文が繰り返されています（${pairs.join("、")}）。片方を削るか、新しい情報に置き換えてください。`);

  // 2. One fact explained again and again across the body.
  const stadium = pack.stadium?.name;
  const repeated = [];
  // Dialogue may bring a figure back to explain it; whether it only repeats the section is checked in 5.
  const explained = body.filter(x => x.b.type !== "DIALOGUE_SCENE");
  for (const fact of pack.facts || []) {
    const keys = factKeywords(fact, stadium);
    const times = explained.filter(x => keys.some(k => norm(x.text).includes(k))).length;
    if (times > 2 && !repeated.some(r => r.label === fact.label)) repeated.push({ label: fact.label, times });
  }
  if (repeated.length) warn("repeated_fact", `同じ事実が何度も説明されています（${repeated.map(r => `${r.label}：${r.times}か所`).join("、")}）。1か所でしっかり説明し、他は省いてください。`);

  // 3. Filler phrases repeated.
  const stock = STOCK_PHRASES.map(p => [p, all.split(p).length - 1]).filter(([, n]) => n >= 2);
  if (stock.length) warn("stock_phrase", `決まり文句が繰り返されています（${stock.map(([p, n]) => `「${p}」${n}回`).join("、")}）。言い換えるか削ってください。`);

  // 4. Longer than the available information supports.
  if (body.length > plan.maxBodyBlocks) warn("too_long_for_facts", `使える情報（${plan.groups}種類）に対して本文ブロックが多すぎます（${body.length}個、目安${plan.maxBodyBlocks}個まで）。同じ内容のブロックをまとめてください。`);

  // 5. Dialogue that only repeats what the section already said.
  let section = [];
  for (const x of blocks) {
    if (x.b.type === "HEADING") { section = []; continue; }
    if (x.b.type === "DIALOGUE_SCENE") {
      const told = section.join("\n");
      const facts = (pack.facts || []).filter(f => factKeywords(f, stadium).some(k => norm(x.text).includes(k)));
      const nothingNew = facts.length >= 2 && facts.every(f => factKeywords(f, stadium).some(k => norm(told).includes(k)));
      const reworded = x.b.data.turns.some(t => sentences(t.text).some(s => sentences(told).some(u => similarity(s, u) >= 0.5)));
      if (nothingNew || reworded) warn("dialogue_restates", `${where(x.i)}：会話が直前の本文の言い換えになっています。会話では、読み方のコツや注意点など本文にない視点を加えてください。`);
    } else if (!x.b.data?.placement) section.push(x.text);
  }

  // 6. Cast: only the characters suited to the theme, and not more voices than the article needs.
  const speakers = [...new Set(blocks.filter(x => x.b.type === "DIALOGUE_SCENE").flatMap(x => x.b.data.turns.map(t => t.character)))];
  const outside = speakers.filter(c => !(plan.allowed || plan.cast).includes(c));
  if (outside.length) warn("cast_mismatch", `このテーマの案内役（${plan.cast.map(c => PERSONAS[c]?.name ?? c).join("・")}）以外のキャラクターが登場しています（${outside.map(c => PERSONAS[c]?.name ?? c).join("・")}）。必要がなければ外してください。`);
  const dialogues = blocks.filter(x => x.b.type === "DIALOGUE_SCENE").length;
  if (dialogues > plan.maxDialogues) warn("too_many_dialogues", `会話シーンが多すぎます（${dialogues}個、目安${plan.maxDialogues}個まで）。`);

  // 7. Course rates listed without saying what they measure.
  const rateValues = (pack.facts || []).filter(f => RATE_FACT.test(f.label)).map(f => norm(f.value));
  const shown = rateValues.filter(v => body.some(x => norm(x.text).includes(v))).length;
  if (shown >= 3 && !EXPLAINS_RATE.test(norm(all))) warn("unexplained_data", "コース別1着率の数字が並んでいますが、何を示す数字か（そのコースから進入した艇が1着になった割合で、枠番とは別）が説明されていません。");

  // 8. Causes or advantages the data cannot show (disclaimers that deny them are fine).
  for (const x of blocks) for (const s of norm(x.text).split(/[。！？\n]/)) if (CAUSAL.test(s) && !NEGATED.test(s)) { warn("causal_claim", `${where(x.i)}：「${s.slice(0, 40)}」は、データから直接言えない因果関係です。確認できる事実だけにしてください。`); break; }

  // 9. Course rates presented as frame (号艇・枠番) rates: a wrong statement of the source, so it blocks approval.
  if (rateValues.length) for (const x of blocks) {
    const s = norm(x.text);
    if (FRAME_RATE.test(s) && rateValues.some(v => s.includes(v))) issues.push({ level: "blocking", code: "course_frame_confusion", message: `${where(x.i)}：コース別1着率を号艇・枠番の数字として書いています。公式データは進入コース別です（枠番とは別）。` });
  }
  // 10. The same caveat written in several places (one warning block is enough; the system note adds the rest).
  for (const [theme, pattern] of CAVEATS) {
    const at = blocks.filter(x => norm(x.text).split(/[。！？\n]/).some(t => pattern.test(t))).map(x => where(x.i));
    if (at.length > 1) warn("repeated_caveat", `同じ注意書き（${theme}）が${at.length}か所にあります（${at.join("、")}）。1か所にまとめてください。`);
  }

  // 11. A summary that only repeats the body.
  const summary = blocks.find(x => x.b.data?.placement === "summary");
  if (summary) {
    const own = sentences(summary.text), told = body.flatMap(x => sentences(x.text));
    const repeatedLines = own.filter(t => told.some(u => similarity(t, u) >= 0.5));
    if (own.length && repeatedLines.length * 2 >= own.length) warn("summary_restates", `${where(summary.i)}：まとめが本文の言い直しになっています。読者が次に確認することを1〜2文で書いてください。`);
  }

  // 12. A DATA CHECK that announces items but lists none.
  for (const x of blocks) if (x.b.type === "DATA_CHECK" && LEAD_IN.test(norm(x.text)) && norm(x.text).split("\n").filter(l => l.trim()).length <= 1)
    warn("empty_data_check", `${where(x.i)}：「確認する項目」を予告していますが、項目がありません。確認する項目を箇条書きで書いてください。`);

  // 13. A longer data article without a dialogue (short articles need none).
  if (plan.maxDialogues >= 1 && body.length >= 6 && rateValues.length && !blocks.some(x => x.b.type === "DIALOGUE_SCENE"))
    warn("dialogue_missing", `会話シーンがありません。読者が迷いやすい点（数字の読み方など）を${plan.cast.map(c => PERSONAS[c]?.name ?? c).join("・")}の会話で1つ扱うと伝わりやすくなります。`);

  // 14. Rates listed (in a sentence or a table) without saying what stands out.
  const rateTables = body.filter(x => x.b.type === "TABLE" && rateValues.filter(v => blockTexts(x.b).some(c => norm(c).trim() === `${v}%`)).length >= 4);
  if ((rateTables.length || body.some(x => norm(x.text).split(/[。！？\n]/).some(t => rateValues.filter(v => quotes(t, v)).length >= 4)))
    && courseRateTables(pack.facts).length && !blocks.some(x => norm(x.text).split(/[。！？\n]/).some(t => /コース/.test(t) && COMPARES.test(t))))
    warn("numbers_without_reading", "コース別1着率を並べていますが、どのコースが高い・低いかなど、データから読み取れる特徴が書かれていません。");

  // 15. Course-rate comparisons that contradict the data: a wrong statement, so it blocks approval.
  for (const x of blocks) {
    const wrong = comparisonMismatches(x.text, pack.facts, dialogueContext(x.b));
    if (wrong.length) issues.push({ level: "blocking", code: "comparison_mismatch", message: `${where(x.i)}：比較がデータと合いません ${wrong.join("、")}。` });
  }
  // 16. A course-rate table whose values differ from the official data (e.g. the system table edited by hand).
  for (const x of blocks) if (x.b.type === "TABLE") {
    const wrong = tableMismatches(x.b.data.rows || [], pack.facts);
    if (wrong.length) issues.push({ level: "blocking", code: "table_mismatch", message: `${where(x.i)}：表の1着率が公式データと合いません（${wrong.join("、")}）。` });
  }

  // 17. The same reading ("1コースが最も高い") stated in several places; a dialogue may revisit it.
  const said = new Map();
  for (const x of blocks) if (x.b.type !== "DIALOGUE_SCENE" && x.b.type !== "HEADING")
    for (const st of rateStatements(x.text, pack.facts)) { if (!said.has(st.key)) said.set(st.key, new Set()); said.get(st.key).add(x.i); }
  const again = [...said.entries()].filter(([, at]) => at.size > 1);
  if (again.length) warn("repeated_reading", `同じデータの特徴を何度も書いています（${again.map(([key, at]) => `${readable(key)}：${[...at].map(i => where(i)).join("、")}`).join("／")}）。1か所で説明し、他は省くか別の特徴にしてください（会話で理解を深めるための再登場は対象外です）。`);

  // 18. Takeaways that already give the numbers or the comparisons the body explains.
  const takeaways = blocks.find(x => x.b.data?.placement === "takeaways");
  if (takeaways) {
    const items = blockTexts(takeaways.b).filter(t => claimsIn(t).some(c => c.kind === "number") || rateStatements(t, pack.facts).length);
    if (items.length) warn("takeaways_restate", `${where(takeaways.i)}：「この記事で分かること」に数字・比較が入っています（「${items.map(t => norm(t).slice(0, 30)).join("」「")}」）。ここは話題だけにし、数字と比較は本文で説明してください。`);
  }

  // 19. Caveats outside their place (the past-data caveat in the WARNING, the day-of checks in the DATA CHECK).
  for (const [theme, pattern] of CAVEATS) {
    const at = blocks.filter(x => !CAVEAT_HOME[theme].includes(x.b.type) && norm(x.text).split(/[。！？\n]/).some(t => pattern.test(t))).map(x => where(x.i));
    if (at.length) warn("caveat_misplaced", `注意書き（${theme}）が${CAVEAT_HOME[theme].join("・")}以外にあります（${at.join("、")}）。${CAVEAT_HOME[theme].join("か")}にまとめてください。`);
  }

  // 20. Body text that adds no information: no fact, number, reading, definition or item to check.
  const informative = t => /\d/.test(t.replace(/1着率?|[1-6]コース/g, "")) || /[1-6]コース/.test(t) || EXPLAINS_RATE.test(t) || DAY_ITEMS.test(t) || /[1-6]コース/.test(t)
    || rateStatements(t, pack.facts).length || (pack.facts || []).some(f => factKeywords(f, stadium).some(k => t.includes(k)));
  for (const x of body) {
    if (!["TEXT", "POINT"].includes(x.b.type)) continue;
    const lines = norm(x.text).split(/[。！？\n]/).map(t => t.trim()).filter(Boolean);
    if (!lines.some(informative)) { warn("low_information", `${where(x.i)}：新しい情報（事実・数字・特徴・確認する項目）がない文章です。削るか、データの説明に置き換えてください。`); continue; }
    const filler = lines.filter(t => FILLER.test(t) && !informative(t));
    if (filler.length) warn("low_information", `${where(x.i)}：「${filler.map(t => t.slice(0, 60)).join("」「")}」は情報を足していない文です。削ってください。`);
  }

  // 21. With the system table in place, the six rates listed again in the text.
  if (rateTables.length) for (const x of body) {
    if (x.b.type === "TABLE") continue;
    if (norm(x.text).split(/[。！？\n]/).some(t => rateValues.filter(v => quotes(t, v)).length >= 3))
      warn("rate_numbers_repeated", `${where(x.i)}：表と同じ1着率の数字を本文で並べています。数字は表に任せ、本文では読み取れる特徴を説明してください。`);
  }

  // 22. Characters doing their part: 初音 asks what a reader would, キイナ brings the outer courses or a surprise.
  const known = norm(JSON.stringify([pack.facts || [], pack.documents || []]));
  for (const x of blocks.filter(y => y.b.type === "DIALOGUE_SCENE")) {
    const lines = c => x.b.data.turns.filter(t => t.character === c).map(t => norm(t.text));
    const notes = [];
    if (lines("hatsune").length && !lines("hatsune").some(t => QUESTION.test(t))) notes.push("初音が読者の疑問を質問していません");
    if (lines("hatsune").some(t => /女子/.test(t)) && !/女子/.test(known)) notes.push("初音が出典にない女子戦の話をしています");
    if (lines("kiina").length && !lines("kiina").some(t => OUTSIDE.test(t))) notes.push("キイナが外コースや意外なデータに触れていません");
    if (notes.length) warn("character_role", `${where(x.i)}：${notes.join("。")}。役割に合った発言にするか、その人物を外してください。`);
  }
  return issues;
}
