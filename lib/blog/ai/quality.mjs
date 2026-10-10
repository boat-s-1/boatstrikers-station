import { articlePlan } from "./articlePlan.mjs";
import { PERSONAS } from "./personas.mjs";
import { claimsIn, norm } from "./claims.mjs";
import { RATE_WARNING, RATE_WARNING_PATTERN } from "./glossary.mjs";
import { comparisonFindings, courseRateTables, courseReadings, dialogueContext, rateStatements, tableMismatches } from "./dataReadings.mjs";

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
  ["過去の数字だけで判断しない", /(過去の(数字|割合|集計|データ|1着率)|集計値|この数字)[^。！？]{0,40}(判断|決め|断定|示すものではない|示す数字ではない|示すものではありません|示す数字ではありません)|(結果|展開)を(示す|保証する)(もの|数字)では(ありません|ない)|(結果|展開)を(断定|決めつけ)|決めつけ|勝つ確率(を示す(もの|数字))?では(ありません|ない)/],
  ["当日の出走表・進入を確認する", /当日[^。！？]{0,30}(出走表|進入|展示|直前情報|公式情報|開催条件)[^。！？]{0,30}(確認|確かめ|見て|見比べ|あわせて)/],
];
const caveatOf = s => CAVEATS.find(([, pattern]) => pattern.test(norm(s)))?.[0];
// blog-ai-v8: the start exhibition's entry stated as the race entry, and a past rate stated as today's chance of winning.
const EXHIBITION_AS_ENTRY = /展示[^。！？]{0,30}(進入|コース)[^。！？]{0,30}(そのまま|確定|必ず|決まる|決まり|同じになる|同じだ|同じです|同じだよ)/;
const RATE_AS_CHANCE = /(今日|当日|このレース|次のレース|これからのレース)[^。！？]{0,30}(勝つ確率|勝率|勝てる確率|勝ちやすい)|(勝つ確率|勝率|勝てる確率)[^。！？]{0,20}(今日|当日|このレース)/;
const DENIES = /(とは限らない|とは限りません|変わる|変わり|ではない|ではありません|ません|しない|せず)/;
// Where each caveat belongs: the past-data caveat in the one WARNING, the day-of checks in the DATA CHECK.
const CAVEAT_HOME = { "過去の数字だけで判断しない": ["WARNING"], "当日の出走表・進入を確認する": ["DATA_CHECK", "WARNING"] };
// A sentence that only says reading helps ("…することで整理できます") adds nothing for the reader.
const FILLER = /(ことで|すると|見ると|分けると|比べると|押さえると)[^。！？]{0,30}(できます|なります|分かります|わかります|やすくなります|にくくなります)$/;
const DAY_ITEMS = /(出走表|展示|進入|モーター|選手|風|波|気象|オッズ)/;
const DAY_WORDS = /(出走表|枠番|号艇|スタート展示|展示タイム|展示|進入|モーター|ボート|選手|体重|部品交換|風向|風速|風|波|気象|天候|オッズ|直前情報|レース条件)/g;
const QUESTION = /(？|\?|ですか|でしょうか|の？|かな？|ますか)/;
const OUTSIDE = /([3-6]コース|外|意外|逆転|穴)/;
// General claims with no source behind them ("インが強いと言われる", "一般的に…") and categorical wording.
// "…とされています" is not among them: it reports what a cited source states.
export const HEARSAY_WORDS = ["と言われ", "といわれ", "一般的に", "一般には", "定説", "通説", "よく知られ", "有名な", "常識的に", "昔から", "に違いない", "に決まって", "間違いなく", "必ず勝"];
const HEARSAY = new RegExp(`(${HEARSAY_WORDS.join("|")})`);
// Explains that the 号艇 (frame number) and the course actually entered are different things.
const FRAME_VS_COURSE = /(号艇|枠番|枠)[^。！？]{0,40}(コース)[^。！？]{0,40}(同じとは限|違い|ではなく|実際に|別)|(コース)[^。！？]{0,40}(号艇|枠番)[^。！？]{0,30}(ではなく|とは限|とは別|違)/;
// A sentence that explains the 号艇 / course difference (in any order of the words).
const isFrameExplanation = t => /(号艇|枠番)/.test(t) && /コース/.test(t) && /(ではなく|とは限|違い|実際に|別の|とは別)/.test(t);
// Ideas the WARNING and DATA CHECK already carry; a dialogue sentence with the same idea says them again.
const NOTE_IDEAS = [/本番で(は)?変わ/, /勝つ確率/, /過去の(集計|数字)[^。]{0,20}(判断|決め|示す)/, /当日の条件/];
// A DATA CHECK line that says why: "・項目 ― 理由", "・項目：理由", or "…ので／ため".
const HAS_REASON = /(―|—|－|ー\s|：|:|ので|ため|から、|ように)/;
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
// How much of the shorter sentence the longer one contains (sentence endings like 「だね」「わけじゃない」 aside):
// a reply that says back what it answers scores high even when it adds a few words.
const ENDINGS = /(だね|だよ|よね|かな|じゃない|ではない|わけじゃない|わけではない|なんだ|んだね|んだ)/g;
export function containment(a, b) {
  const x = bigrams(norm(a).replace(ENDINGS, "")), y = bigrams(norm(b).replace(ENDINGS, ""));
  let shared = 0, nx = 0, ny = 0;
  for (const [k, n] of x) { shared += Math.min(n, y.get(k) || 0); nx += n; }
  for (const n of y.values()) ny += n;
  return Math.min(nx, ny) ? shared / Math.min(nx, ny) : 0;
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
    // The same caveat in two places is counted once, by 10 (not here as well).
    if (sentences(body[a].text).some(s => sentences(body[c].text).some(t => similarity(s, t) >= 0.6 && !(caveatOf(s) && caveatOf(s) === caveatOf(t))))) pairs.push(`${where(body[a].i)}と${where(body[c].i)}`);
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
    } else if (!x.b.data?.placement && x.b.type !== "TABLE") section.push(x.text); // the table is data, not an explanation to repeat
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
  // One finding per caveat: when it is repeated, the places outside its home are named in the same note (19 is for
  // a caveat written once, in the wrong place), so one sentence never costs two points.
  const caveatPlaces = CAVEATS.map(([theme, pattern]) => {
    const found = blocks.filter(x => norm(x.text).split(/[。！？\n]/).some(t => pattern.test(t)));
    return { theme, at: found.map(x => where(x.i)), outside: found.filter(x => !CAVEAT_HOME[theme].includes(x.b.type)).map(x => where(x.i)) };
  });
  for (const { theme, at, outside } of caveatPlaces) if (at.length > 1)
    warn("repeated_caveat", `同じ注意書き（${theme}）が${at.length}か所にあります（${at.join("、")}）。1か所にまとめてください。${outside.length ? `${CAVEAT_HOME[theme].join("・")}以外：${outside.join("、")}。` : ""}`);

  // 11. A summary that only repeats the body.
  const summary = blocks.find(x => x.b.data?.placement === "summary");
  if (summary) {
    const own = sentences(summary.text), told = body.flatMap(x => sentences(x.text));
    const repeatedLines = own.filter(t => told.some(u => similarity(t, u) >= 0.5));
    if (own.length && repeatedLines.length * 2 >= own.length) warn("summary_restates", `${where(summary.i)}：まとめが本文の言い直しになっています。発見は本文の文や数字を繰り返さず、違う言葉で1〜2文で振り返ってください。`);
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

  // 15. Course-rate comparisons that contradict the data: a clear wrong statement blocks approval; one whose meaning
  // is not certain (a negation before it in its clause, or several periods) is shown for review.
  for (const x of blocks) {
    const { certain, unclear } = comparisonFindings(x.text, pack.facts, dialogueContext(x.b));
    if (certain.length) issues.push({ level: "blocking", code: "comparison_mismatch", message: `${where(x.i)}：比較がデータと合いません ${certain.join("、")}。` });
    if (unclear.length) warn("comparison_unclear", `${where(x.i)}：データと合わない可能性がある比較があります ${unclear.join("、")}。文の意味を確認し、必要なら書き直してください。`);
  }
  // 16. A course-rate table whose values differ from the official data (e.g. the system table edited by hand).
  for (const x of blocks) if (x.b.type === "TABLE") {
    const wrong = tableMismatches(x.b.data.rows || [], pack.facts);
    if (wrong.length) issues.push({ level: "blocking", code: "table_mismatch", message: `${where(x.i)}：表の1着率が公式データと合いません（${wrong.join("、")}）。` });
  }

  // 17. The same reading ("1コースが最も高い") stated in several places; a dialogue may revisit it.
  const said = new Map();
  const keyReadings = new Set(courseReadings(pack.facts).filter(r => r.featured).map(r => r.key));
  for (const x of blocks) if (x.b.type !== "DIALOGUE_SCENE" && x.b.type !== "HEADING") {
    const statements = rateStatements(x.text, pack.facts);
    // The summary may bring back one or two featured readings as what was found (not counted as a repetition).
    const recap = x.b.data?.placement === "summary" && statements.filter(st => keyReadings.has(st.key)).length <= 2;
    for (const st of statements) {
      if (recap && keyReadings.has(st.key)) continue;
      if (!said.has(st.key)) said.set(st.key, new Set()); said.get(st.key).add(x.i);
    }
  }
  const again = [...said.entries()].filter(([, at]) => at.size > 1);
  if (again.length) warn("repeated_reading", `同じデータの特徴を何度も書いています（${again.map(([key, at]) => `${readable(key)}：${[...at].map(i => where(i)).join("、")}`).join("／")}）。1か所で説明し、他は省くか別の特徴にしてください（会話で理解を深めるための再登場は対象外です）。`);

  // 18. Takeaways that already give the numbers or the comparisons the body explains.
  const takeaways = blocks.find(x => x.b.data?.placement === "takeaways");
  if (takeaways) {
    const items = blockTexts(takeaways.b).filter(t => claimsIn(t).some(c => c.kind === "number") || rateStatements(t, pack.facts).length);
    if (items.length) warn("takeaways_restate", `${where(takeaways.i)}：「この記事で分かること」に数字・比較が入っています（「${items.map(t => norm(t).slice(0, 30)).join("」「")}」）。ここは話題だけにし、数字と比較は本文で説明してください。`);
  }

  // 19. A caveat written once, outside its place (the past-data caveat in the WARNING, the day-of checks in the DATA CHECK).
  for (const { theme, at, outside } of caveatPlaces) if (at.length === 1 && outside.length)
    warn("caveat_misplaced", `注意書き（${theme}）が${CAVEAT_HOME[theme].join("・")}以外にあります（${outside.join("、")}）。${CAVEAT_HOME[theme].join("か")}にまとめてください。`);

  // 32. The 号艇 / course explanation given more than once (the DATA CHECK reason and the takeaways do not count; the
  // summary's own check covers it there).
  const explaining = blocks.filter(x => !["DIALOGUE_SCENE", "DATA_CHECK", "HEADING"].includes(x.b.type) && !["takeaways", "summary"].includes(x.b.data?.placement)
    && norm(x.text).split(/[。！？\n]/).some(isFrameExplanation));
  if (explaining.length > 1) warn("explanation_repeated", `号艇と進入コースの違いの説明が${explaining.length}か所にあります（${explaining.map(x => where(x.i)).join("、")}）。表の前の1か所だけにしてください。`);

  // 33. A dialogue that says again what the WARNING or the DATA CHECK reasons say (past data, the race may differ).
  const notes = blocks.filter(x => x.b.type === "WARNING" || x.b.type === "DATA_CHECK")
    .flatMap(x => norm(x.text).split(/[。\n]/).map(t => t.replace(/^[・\s]+/, "").split(/\s*[―—－]\s*/).at(-1).trim()).filter(t => plain(t).length >= 8));
  for (const x of blocks.filter(y => y.b.type === "DIALOGUE_SCENE")) {
    const said = (x.b.data.turns || []).flatMap(t => norm(t.text).split(/[。！？!?]/).map(s => s.trim()).filter(s => plain(s).length >= 8));
    const repeats = said.filter(s => notes.some(n => containment(s, n) >= 0.4) || (NOTE_IDEAS.some(re => re.test(s) && notes.some(n => re.test(n)))));
    if (repeats.length) warn("dialogue_repeats_note", `${where(x.i)}：会話が注意書き・確認項目の内容を言い直しています（「${repeats.map(t => t.slice(0, 40)).join("」「")}」）。会話では読み方を加え、確かめ方は確認項目を指すだけにしてください。`);
  }

  // 35. The exhibition's entry written as the race entry, or a past course rate as today's chance of winning (a
  // denial such as "…とは限らない" or "…ではありません" is the caveat itself, not the claim).
  for (const x of blocks) for (const t of norm(x.text).split(/[。！？\n]/)) {
    if (DENIES.test(t)) continue;
    if (EXHIBITION_AS_ENTRY.test(t)) { warn("exhibition_as_entry", `${where(x.i)}：「${t.slice(0, 50)}」は、スタート展示の進入を本番の進入として書いています。本番では変わることもあるので、参考として書いてください。`); break; }
    if (RATE_AS_CHANCE.test(t)) { warn("rate_as_chance", `${where(x.i)}：「${t.slice(0, 50)}」は、過去の1着率を当日の勝つ確率として書いています。過去の集計期間の数字として説明してください。`); break; }
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

  // 23. With the system table in place, the order of the courses told again in a sentence.
  if (rateTables.length) for (const x of body) {
    if (x.b.type === "TABLE" || x.b.type === "DIALOGUE_SCENE") continue;
    const order = rateStatements(x.text, pack.facts).find(st => st.kind === "order" && st.courses.length >= 4);
    if (order) warn("table_restated", `${where(x.i)}：「${order.text.trim()}」は表と同じ並びの繰り返しです。並びは表に任せ、本文では読み取れる特徴を説明してください。`);
  }

  // 24. DATA CHECK items that repeat each other ("当日の出走表・進入" next to "出走表の枠番" and "スタート展示の進入").
  for (const x of blocks) if (x.b.type === "DATA_CHECK") {
    // Only the item itself counts here, not the reason after "―" or "：".
    const items = norm(x.text).split("\n").map(l => l.replace(/^[・\-\s]+/, "").split(/\s*[―—－：:]\s*/)[0].trim()).filter(Boolean);
    const words = items.map(item => new Set((item.match(DAY_WORDS) || []).map(w => (w === "スタート展示" ? "展示" : w))));
    const repeated = items.filter((item, i) => {
      const others = items.filter((_, j) => j !== i);
      const covered = words[i].size && [...words[i]].every(w => words.some((ws, j) => j !== i && ws.has(w)));
      return covered || others.some(o => similarity(item, o) >= 0.6 && plain(item).length >= 4);
    });
    if (repeated.length) warn("data_check_overlap", `${where(x.i)}：確認する項目が重なっています（「${repeated.join("」「")}」は他の項目と同じ内容を含みます）。重ならない3〜4項目にしてください。`);
  }

  // 25. Comparisons in the title, excerpt and SEO texts, checked like the body.
  for (const [label, text] of [["タイトル", document.title], ["抜粋", document.excerpt], ["SEOタイトル", document.seo?.title], ["SEO説明文", document.seo?.description]]) {
    const { certain, unclear } = comparisonFindings(text || "", pack.facts);
    if (certain.length) issues.push({ level: "blocking", code: "comparison_mismatch", message: `${label}：比較がデータと合いません ${certain.join("、")}。` });
    if (unclear.length) warn("comparison_unclear", `${label}：データと合わない可能性がある比較があります ${unclear.join("、")}。文の意味を確認し、必要なら書き直してください。`);
  }

  // 26. General claims with no source ("…と言われる", "一般的に…") anywhere in the article.
  const hearsay = [["タイトル", document.title], ["抜粋", document.excerpt], ["SEO説明文", document.seo?.description], ...blocks.map(x => [where(x.i), x.text])]
    .flatMap(([at, text]) => norm(text || "").split(/[。！？\n]/).filter(t => HEARSAY.test(t)).map(t => `${at}「${t.trim().slice(0, 40)}」`));
  if (hearsay.length) warn("unsourced_claim", `出典のない一般論や断定があります（${hearsay.join("、")}）。出典の事実に置き換えるか、削ってください。`);

  // 27. A dialogue answer that repeats the line it answers.
  for (const x of blocks.filter(y => y.b.type === "DIALOGUE_SCENE")) {
    const turns = x.b.data.turns || [];
    const clauses = text => norm(text).split(/[。！？!?\n]/).map(t => t.trim()).filter(t => plain(t).length >= 8);
    const echoes = turns.slice(1).filter((turn, n) => turn.character !== turns[n].character
      && clauses(turn.text).some(a => clauses(turns[n].text).some(b => containment(a, b) >= 0.4)));
    if (echoes.length) warn("dialogue_echo", `${where(x.i)}：${echoes.map(t => PERSONAS[t.character]?.name ?? t.character).join("・")}の発言が、直前の発言の言い直しになっています。相手の言葉を繰り返さず、数字の使い方など新しい視点を加えてください。`);
  }

  // 28〜31. The blog-ai-v7 structure (packs from version 3 on): a lead that opens a question or a find, the 号艇 /
  // course difference explained before the table, reasons in the DATA CHECK, and a summary that keeps what was found.
  if ((pack.version ?? 0) >= 3) {
    const leadBlock = blocks.find(x => x.b.data?.placement === "lead");
    const titleKeys = new Set(rateStatements(document.title || "", pack.facts).map(st => st.key));
    if (!leadBlock) warn("lead_missing", "導入文がありません。本文の最初に、読者が続きを読みたくなる問いや発見を1〜3文で置いてください。");
    else {
      const t = norm(leadBlock.text);
      const hooks = /[？?]/.test(t) || rateStatements(t, pack.facts).length || /(意外|注目|気づ|発見|ところがあります)/.test(t);
      if (!hooks) warn("lead_without_hook", `${where(leadBlock.i)}：導入文に、読者の興味を引く問いや発見がありません。`);
      const shared = rateStatements(t, pack.facts).filter(st => titleKeys.has(st.key));
      if (shared.length) warn("lead_repeats_title", `${where(leadBlock.i)}：導入文がタイトルと同じ発見（${shared.map(st => readable(st.key)).join("、")}）を繰り返しています。導入では別の問いや発見を置いてください。`);
    }
    const tableAt = blocks.findIndex(x => x.b.type === "TABLE");
    if (rateValues.length && tableAt >= 0) {
      // The takeaways only name the topic; the explanation has to be in the text before the table.
      const before = blocks.slice(0, tableAt).filter(x => x.b.type !== "HEADING" && x.b.data?.placement !== "takeaways").map(x => norm(x.text)).join("\n");
      if (!FRAME_VS_COURSE.test(before)) warn("frame_course_unexplained", "号艇（枠番）と進入コースの違いが、表より前で説明されていません。初心者が表を読めるよう、表の前に1回だけ説明してください。");
    }
    for (const x of blocks.filter(y => y.b.type === "DATA_CHECK")) {
      const lines = norm(x.text).split("\n").map(l => l.replace(/^[・\-\s]+/, "").trim()).filter(Boolean);
      const bare = lines.filter(l => !HAS_REASON.test(l));
      if (bare.length) warn("data_check_without_reason", `${where(x.i)}：確認する理由がない項目があります（「${bare.join("」「")}」）。「確認項目 ― 確認する理由」の形にしてください。`);
    }
    if (summary) {
      const featuredKeys = new Set(courseReadings(pack.facts).filter(r => r.featured).map(r => r.key));
      const found = rateStatements(summary.text, pack.facts, { context: true }).filter(st => featuredKeys.has(st.key));
      if (featuredKeys.size && !found.length) warn("summary_without_finding", `${where(summary.i)}：まとめに、この記事で分かったデータ上の発見がありません。重要な発見を1〜2個取り上げてください。`);
      if (EXPLAINS_RATE.test(norm(summary.text)) || /(大切です|重要です)$/.test(norm(summary.text).replace(/。$/, "")))
        warn("summary_repeats_definition", `${where(summary.i)}：まとめが定義や一般的な心がけの言い直しになっています。発見と、その読み方を書いてください。`);
    }
  }

  // 34. blog-ai-v8 (packs from version 4 on): the course-rate caveat is in a WARNING (composing puts it there; an edit
  // may take it out).
  if ((pack.version ?? 0) >= 4 && rateValues.length && blocks.some(x => x.b.type === "TABLE")
    && !blocks.some(x => x.b.type === "WARNING" && RATE_WARNING_PATTERN.test(norm(x.text))))
    warn("warning_note_missing", `WARNINGに「${RATE_WARNING}」がありません。注意書きとしてWARNINGに残してください。`);

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
