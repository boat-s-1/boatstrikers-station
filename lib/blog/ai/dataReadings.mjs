import { norm } from "./claims.mjs";

// What the course rates of one period say on their face, computed from the facts so the AI can explain the
// numbers without inventing comparisons. Readings only rank and compare recorded values; they never compute a
// new number (no differences, ratios or sums).

const RATE_LABEL = /^(.+)の([1-6])コース1着率$/;
const NEAR = 0.5; // values this close are described as "ほぼ同じ水準"
// PHASE 5.0: neighbours this close (but further apart than NEAR) are "順位は違うが差は小さい". An editorial convention
// that keeps articles consistent; it says nothing about statistical significance or the importance of a difference.
export const CLOSE = 1.0;
const MAX_FEATURED = 3;

// One complete table per source and period: { source_id, period, rates: [{ course, value, text }] } (6 courses).
export function courseRateTables(facts = []) {
  const tables = new Map();
  for (const f of facts) {
    const m = RATE_LABEL.exec(norm(f.label));
    const value = Number(norm(f.value));
    if (!m || !Number.isFinite(value)) continue;
    const key = `${f.source_id}|${f.period ?? ""}`;
    if (!tables.has(key)) tables.set(key, { source_id: f.source_id, period: f.period ?? null, rates: [] });
    tables.get(key).rates.push({ course: Number(m[2]), value, text: norm(f.value).trim() });
  }
  return [...tables.values()].filter(t => t.rates.length === 6 && new Set(t.rates.map(r => r.course)).size === 6)
    .map(t => ({ ...t, rates: t.rates.sort((a, b) => a.course - b.course) }));
}

// The table an article can show and be checked against: only when exactly one complete table with a period exists.
export function rateTable(facts = []) {
  const tables = courseRateTables(facts);
  return tables.length === 1 && tables[0].period ? tables[0] : null;
}

const unique = (rates, pick) => { const best = pick(...rates.map(r => r.value)); const hit = rates.filter(r => r.value === best); return hit.length === 1 ? hit[0] : null; };
// Whether the rates fall from 1コース to 6コース: true (each clearly below the one inside it), false (an outer course
// above the one inside it), null (no reversal, but two neighbours are within the "near" margin: a judgement).
export function inOrder(rates) {
  let near = false;
  for (let c = 1; c < 6; c++) {
    const [a, b] = [rates[c - 1], rates[c]];
    if (b.value > a.value && b.value - a.value > NEAR) return false;
    if (Math.abs(a.value - b.value) <= NEAR) near = true;
  }
  return near ? null : true;
}
// Rank of each course among the six (1 = highest), only when every value differs.
const ranks = rates => new Set(rates.map(r => r.value)).size === rates.length
  ? new Map([...rates].sort((a, b) => b.value - a.value).map((r, i) => [r.course, i + 1])) : null;

// Readings: { id, key, kind, source_id, period, text, featured }. key identifies the statement, so an article's
// sentences can be matched to it (see rateStatements).
// extended (source packs from version 5, PHASE 5.0): readings that relate two facts (1コース the highest yet below half;
// neighbours close together) and an unambiguous wording of the inside-first order. Older packs keep their readings.
export function courseReadings(facts = [], { extended = false } = {}) {
  let n = 0;
  return courseRateTables(facts).flatMap(table => {
    const out = [], rates = table.rates, at = c => rates[c - 1];
    const add = (kind, key, text) => out.push({ id: `R${++n}`, key, kind, source_id: table.source_id, period: table.period, text, featured: false });
    const top = unique(rates, Math.max), bottom = unique(rates, Math.min);
    if (top) add("top", `top:${top.course}:高`, `${top.course}コースの1着率（${top.text}%）が6つのコースの中で最も高い`);
    if (top && top.value > 50) add("half", `half:${top.course}`, `${top.course}コースの1着率（${top.text}%）は半分を超えている`);
    // blog-ai-v11: what a stadium without an exception has to tell. The leading 1コース below half…
    if (top?.course === 1 && top.value < 50) add("under_half", "under_half:1", `1コースの1着率（${top.text}%）は半分に届いていない`);
    // The leading course below half: "the highest of the six" and "first in half the races or more" are two things.
    if (extended && top?.course === 1 && top.value < 50) add("top_not_majority", "contrast:1", `1コースの1着率（${top.text}%）は6つのコースの中で最も高いが、半分には届いていない`);
    if (bottom) add("bottom", `top:${bottom.course}:低`, `${bottom.course}コースの1着率（${bottom.text}%）が最も低い`);
    if (top?.course === 1) {
      const second = unique(rates.slice(1), Math.max);
      if (second) add("except_top", `except:${second.course}:高`, `${second.course}コースの1着率（${second.text}%）は1コース以外で最も高い`);
    }
    for (let c = 1; c < 6; c++) {
      const [a, b] = [at(c), at(c + 1)];
      if (extended && a.value === b.value) {
        // Version 5: the same value is "同じ値", never "ほぼ同じ" (key equal:a:b, as an article states it).
        add("same", `equal:${a.course}:${b.course}`, `${a.course}コース（${a.text}%）と${b.course}コース（${b.text}%）の1着率は同じ値`);
      } else if (Math.abs(a.value - b.value) <= NEAR) {
        const higher = a.value === b.value ? "同じ値" : `わずかに${(a.value > b.value ? a : b).course}コースが高い`;
        add("near", `near:${a.course}:${b.course}`, `${a.course}コース（${a.text}%）と${b.course}コース（${b.text}%）の1着率はほぼ同じ水準（${higher}）`);
      } else if (b.value > a.value) {
        // An outer course above the inner one next to it: the order is not simply "inside first".
        add("reversal", `pair:${b.course}>${a.course}`, `${b.course}コースの1着率（${b.text}%）は${a.course}コース（${a.text}%）より高い`);
      }
      // Close, though not "ほぼ同じ" (a reversal can be close too: its size is part of the reading).
      if (extended && Math.abs(a.value - b.value) > NEAR && Math.abs(a.value - b.value) <= CLOSE)
        add("close", `close:${a.course}:${b.course}`, `${a.course}コース（${a.text}%）と${b.course}コース（${b.text}%）は、順位は違うが差は小さい`);
    }
    if (ranks(rates)) add("order", "order", `1着率の高い順：${[...rates].sort((a, b) => b.value - a.value).map(r => `${r.course}コース`).join("→")}`);
    // …and the six rates falling from 1コース to 6コース without exception (no near tie either).
    if (inOrder(rates) === true) add("in_order", "sequence:in", extended
      ? "1着率は外側のコースほど順に低い（1コースから6コースまで、順番の入れ替わりがない）"
      : "1着率は1コースから6コースまで、内側から順に高い（順番が入れ替わるところがない）");
    // The 2〜3 readings most useful to a reader: the leading course, what breaks the inside-first order and the
    // best of the rest; then near ties and the lowest.
    const pick = (extended ? [
      out.find(r => r.kind === "half") ?? out.find(r => r.kind === "top_not_majority") ?? out.find(r => r.kind === "top"),
      out.find(r => r.kind === "reversal"),
      out.find(r => r.kind === "close") ?? out.find(r => r.kind === "same") ?? out.find(r => r.kind === "near"),
      out.find(r => r.kind === "in_order"),
      out.find(r => r.kind === "except_top"),
      out.find(r => r.kind === "bottom"),
    ] : [
      out.find(r => r.kind === "half") ?? out.find(r => r.kind === "under_half") ?? out.find(r => r.kind === "top"),
      out.find(r => r.kind === "reversal"),
      out.find(r => r.kind === "in_order"),
      out.find(r => r.kind === "except_top"),
      out.find(r => r.kind === "near"),
      out.find(r => r.kind === "bottom"),
    ]).filter(Boolean).slice(0, MAX_FEATURED);
    for (const r of pick) r.featured = true;
    return out;
  });
}

// The readings of a source pack: extended from version 5 on (PHASE 5.0).
export const packReadings = pack => courseReadings(pack?.facts || [], { extended: (pack?.version ?? 0) >= 5 });

// ---- Statements about course rates in an article's text ----
// Only sentences that speak of the 1着率 (or quote a rate value), name the course(s) and state a clear direction
// are read. A negation applies to the clause it ends: "4コースは3コースより高く、内側から順に下がるわけではありません"
// states 4コース > 3コース, "4コースが3コースより高いわけではありません" states nothing. Statements limited to part of
// the courses ("4〜6コースの中では") are left alone. A statement after a negation in its own clause ("3コースではなく
// 4コースが…") is uncertain: when it contradicts the data it is reported for review rather than blocking approval.

const NOT_COURSE = "(?:(?![1-6]コース)[^。！？])";
const BEST = "(?:最も|一番|もっとも|いちばん)";
const EXCEPT = "1コース(?:以外|を除(?:く|いて|けば))";
const EXCEPT_FIRST = new RegExp(`([2-6])コース(?:は|が)${NOT_COURSE}{0,8}?${EXCEPT}${NOT_COURSE}{0,14}?${BEST}(高|低)`, "g");
const EXCEPT_LEAD = new RegExp(`${EXCEPT}${NOT_COURSE}{0,10}?([2-6])コース(?:は|が)${NOT_COURSE}{0,10}?${BEST}(高|低)`, "g");
const SUPERLATIVE = new RegExp(`([1-6])コース(?:は|が)(${NOT_COURSE}{0,16}?)${BEST}(高|低)`, "g");
const ORDINAL = new RegExp(`([1-6])コース(?:は|が)(${NOT_COURSE}{0,12}?)([2-5])番目に(高|低)`, "g");
const PAIRWISE = new RegExp(`([1-6])コース(?:は|が)${NOT_COURSE}{0,10}?([1-6])コース(?:より|を)(?:も)?${NOT_COURSE}{0,6}?(高|低|上回|下回|上|下)`, "g");
const HALF = new RegExp(`([1-6])コース(?:は|が)${NOT_COURSE}{0,16}?(?:半分を?超え|半数を?超え|過半数)`, "g");
const NEAR_PAIR = new RegExp(`([1-6])コースと([1-6])コース(?:は|が)?${NOT_COURSE}{0,12}?(?:ほぼ同じ|ほとんど同じ|ほぼ並|同じ水準|ほぼ互角)`, "g");
// PHASE 5.1 (version 5): the two figures named first ("2コースは13.2%、3コースは13.4%と、ほぼ並んでいます"; the figures
// are taken out before matching, see prepare).
const NEAR_FIGURES = new RegExp(`([1-6])コース(?:は|が)?\\s*、\\s*([1-6])コース(?:は|が)?\\s*(?:と|で)、?${NOT_COURSE}{0,8}?(?:ほぼ同じ|ほとんど同じ|ほぼ並|同じ水準|ほぼ互角)`, "g");
const NEGATION = /(ではない|ではありません|とは限|わけではない|わけではありません|とは言えない|とは言えません|ことはない|ことはありません|ではなく|わけでもな)/;
// blog-ai-v11: 1コース below half ("半分に届いていない", "半分未満", "半分を超えていない").
const UNDER_HALF = new RegExp(`([1-6])コース(?:は|が)${NOT_COURSE}{0,16}?(?:半分|半数|5割)(?:に(?:は)?届(?:か(?:ない|ず)|いて(?:い)?(?:ない|ません))|未満|を下回|を(?:超えて|上回って)(?:い)?(?:ない|ません))`, "g");
// ---- PHASE 5.0 (source packs from version 5 only: rateStatements' extended option) ----
// Older packs keep the patterns above, so a draft made from them is read and checked exactly as before.
// The half lesson's wording ("1コースから進入した艇が、半分を超えるレースで1着になりました").
// PHASE 5.1: also "1コースの1着率は54.7%で、半分を超え" and "1コースから進入した艇の1着率が…半分を超え".
// PHASE 5.2: also "半数を上回りました"; never a denied form ("半数を上回っていません" is read as below half). As far from
// the subject as below half (32), for "1コースから進入した艇が1着になったレースの割合は、この集計期間では半分を超え".
const HALF_V5 = new RegExp(`([1-6])コース(?:は|が|の1着率(?:は|が)|から進入した艇(?:の1着率)?(?:は|が))${NOT_COURSE}{0,32}?(?:(?:半分|半数)を?(?:超え(?!て(?:い)?(?:ない|ません|なかった)|ない|ず|ません|なかった)|上回(?!って(?:い)?(?:ない|ません|なかった)|らない|らず|らなかった|りません))|過半数)`, "g");
// Below half said further from the course, or politely ("1コースは6つのコースの中で最も高いのに、半分には届きません").
// PHASE 5.1: also "半分以上には届きませんでした".
// PHASE 5.2: with the subjects HALF_V5 reads ("1コースから進入した艇の1着率は", "…艇が1着になったレースの割合は") and the
// denied forms of "超える" / "上回る" ("半数を上回っていません", "半分を超えませんでした").
const UNDER_HALF_V5 = new RegExp(`([1-6])コース(?:は|が|の1着率(?:は|が)|から進入した艇(?:の1着率)?(?:は|が))${NOT_COURSE}{0,32}?(?:半分|半数|5割)(?:以上)?(?:に(?:は|も)?届(?:か(?:ない|ず|なかった)|き(?:ません|ませんでした)|いて(?:い)?(?:ない|ません))|未満|を下回|を(?:超えて|上回って)(?:い)?(?:ない|ません|なかった)|を(?:超え|上回ら)(?:ない|ず|なかった)|を(?:超え|上回り)ません)`, "g");
// PHASE 5.2: "半分以上のレースで1着になったわけではない" says below half in so many words; it is read as "半分に届かない"
// (the negation is part of the statement, not a denial of one).
const UNDER_HALF_RACES_V5 = /(?:半分|半数)以上のレースで1着に(?:なった(?:わけ)?では(?:ない|ありません|なかった)|なって(?:い)?(?:ない|ません)|なら(?:ない|なかった))/g;
// Two courses "close" (a judgement, checked against the CLOSE margin) or "equal" (a fact: wrong when the values differ).
const CLOSE_PAIR = new RegExp(`([1-6])コース${NOT_COURSE}{0,8}?と([1-6])コース${NOT_COURSE}{0,24}?差(?:は|が)(?:小さ|わずか)`, "g");
// PHASE 5.1: the two figures named first ("3コースは14.9%、4コースは14.2%で、順位は違いますが差は小さい"; figures taken out).
const CLOSE_FIGURES = new RegExp(`([1-6])コース(?:は|が)?\\s*、\\s*([1-6])コース(?:は|が)?\\s*(?:と|で)、?${NOT_COURSE}{0,16}?差(?:は|が)(?:小さ|わずか)`, "g");
const EQUAL_PAIR = new RegExp(`([1-6])コース${NOT_COURSE}{0,8}?と([1-6])コース${NOT_COURSE}{0,24}?(?:差(?:は|が)(?:ない|ありません|ゼロ)|(?<!ほぼ|ほとんど)(?:まったく|全く)?同じ(?:数字|値)(?:です|だ|で(?![はも])|。|$))`, "g");
// Whether the six rates are in inside-first order, stated without naming the courses (see orderClaims).
const SEQUENCE = /(内側(?:のコース)?(?:から|ほど)|1コースから(?:6コースまで)?|コース番号の)(?:(?!。)[^、]){0,8}?順(?:番)?(?:に|どおり|通り)/;
// PHASE 5.0 (version 5): "内側から外側に向かって…順に低く" and "外側のコースほど順に低い" say the same.
// A comma may follow "ほど" ("外側のコースほど、1着率が順に低く並んでいます", as the in-order lesson words it).
const SEQUENCE_V5 = /(内側(?:のコース)?(?:から|ほど)(?:外側(?:のコース)?(?:に向かって|へ)?)?|外側(?:のコース)?(?:へ向かう|に向かう)?ほど、?|1コースから(?:6コースまで)?|コース番号の)(?:(?!。)[^、]){0,12}?順(?:番)?(?:に|どおり|通り)/;
const SEQUENCE_NOT = /(並んで(?:い)?(?:ない|ません)|並ば(?:ない|ず)|(?:高く|低く)(?:なって)?(?:い)?(?:ない|ません)|(?:下が|上が)(?:って)?(?:い)?(?:ない|ません)|わけではな|わけではありません|わけじゃな|じゃな|とは限らない|とは限りません|ではな|ではありません|入れ替わ|崩れ|例外|ところがあ|部分があ|箇所があ)/;
const SEQUENCE_YES = /(並んで(?:い)?(?:る|ます)|並ぶ|並びます|高く(?:なって(?:い)?(?:る|ます)|なる|なります)|下が(?:って(?:い)?(?:る|ます)|る|ります)|低く(?:なって(?:い)?(?:る|ます)|なる|なります)|高い|低い)/;
// PHASE 5.0 (version 5): past forms too ("外側のコースほど順に低くなりました", as the in-order lesson words it).
// PHASE 5.1: also "外側へ向かうほど1着率が順に低く並び、…" (the clause goes on after "並び").
const SEQUENCE_YES_V5 = /((?:高く|低く)並び$|並んで(?:い)?(?:る|ます|た|ました)|並ぶ|並びます|並びました|並んだ|(?:高く|低く)(?:なって(?:い)?(?:る|ます|た|ました)|なる|なります|なりました|なった)|下が(?:って(?:い)?(?:る|ます|た|ました)|る|ります|りました|った)|高い|低い|高かった|低かった)/;
// A plain question ("…並んでいるでしょうか") claims nothing; a guess or a hedge ("…じゃない？", "…かも", "…とは限らない")
// claims nothing for certain.
const QUESTION = /(でしょうか|ですか|ますか|のか)[？?]?$/;
// A correction for every pack version (PHASE 5.0): "かな" and "かも" only as a guess ("…かな？", "…かもしれない"), never
// inside a word ("届かない", "しかも"). Before, "1コースは半分に届かない" counted as a hedge, so a wrong claim in such a
// sentence was only shown for review; it is now checked like any plain statement (stricter, never looser).
const HEDGE = /(かな[？?！!]?$|かも(?:しれ|ね|よ|[？?]?$)|じゃない[？?]?$|んじゃない|[？?]$|と思|とは限)/;
// "高い順に見ると、1コース、2コース、4コース…": an order of three or more courses.
const ORDER = new RegExp(`(高い|低い)順${NOT_COURSE}{0,12}?([1-6]コース(?:\\s*[、,・→]\\s*[1-6]コース){2,5})`, "g");
// Limits a statement to part of the courses; "6つのコースの中で" (all of them) does not.
const ALL_COURSES = /(6つ|全|すべて|全部)の?コースの?中で/g;
const PARTIAL = /(以外|除い|除く|除け|うち|コースの中で|コースでは|外側|内側|外コース|内コース|[1-6]コース?[〜~・][1-6]コース)/;
// "…で最も高い外側のコース": the superlative is about part of the courses.
const LIMITED_AFTER = /^い?(外側|内側|外の|内の|外コース|内コース|アウト|センター)/;
const partial = fragment => PARTIAL.test(fragment.replace(ALL_COURSES, ""));

// Course rates read as plain course names: "4コースの1着率10.0%は3コースの8.5%を上回る" → "4コースは3コースを上回る".
const prepare = sentence => sentence
  .replace(/[（(]\s*\d+(?:\.\d+)?\s*[%％]\s*[）)]/g, "")
  .replace(/コースの?1着率/g, "コース")
  .replace(/\d+(?:\.\d+)?\s*[%％]/g, "")
  .replace(/コースの(?=より|を|は|が)/g, "コース");

// The clause a statement ends in: from the end of its match to the next "、" (or the end of the sentence).
const clauseAfter = after => after.split(/[、,]/)[0];
const clauseBefore = before => before.split(/[、,]/).pop();

const rateContext = (sentence, values) => /1着率/.test(sentence) || values.some(v => sentence.includes(`${v}%`) || sentence.includes(`${v}％`));
// PHASE 5.2 (version 5): the 1着率 told by its definition ("1コースから進入した艇が1着になったレースの割合"), as the
// prompt asks a half comparison to be written. ("…半分を超えるレースで1着になりました" alone stays read with its block.)
const RATE_DEFINED_V5 = /1着になった(?:レースの)?割合/;
// PHASE 5.1 (version 5): a sentence in a block that speaks of the 1着率 is read with it ("…54.7%でした。この期間に1コース
// から進入した艇が、半分を超えるレースで1着になった"), unless it names another figure, which is never read as the 1着率.
const OTHER_METRIC = /(2着率|3着率|[23]着|連対率|勝率|取得率|決まり手|逃げ|捲り|まくり|差し|恵まれ|抜き|入着率|展示タイム|タイム|モーター|オッズ|配当|払戻)/;
// …nor a sentence that turns to another subject (another stadium or period, general talk).
const TOPIC_SHIFT = /(ところで|話は変わ|それとは別に|別の(場|レース場|期間|集計)|他の(場|レース場|期間)|ほかの(場|レース場|期間)|一般に|一般的に|季節別|春季|夏季|秋季|冬季)/;
// A claim inside quotation marks is checked like any other (a line quoted as right, a character's words): the marks alone
// change nothing. Only a quoted view that the text reports and then denies ("「1コースが半分を超える」という見方もありますが、
// この期間は違います") is shown for review instead of blocking.
const insideQuote = before => (before.match(/[「『]/g) || []).length > (before.match(/[」』]/g) || []).length;
const REPORTED = /^[」』]?\s*((という|といった|との)(見方|説明|声|意見|話|イメージ|印象|考え|説|読み方)|と(は)?(言われ|いわれ|書かれ|説明され|紹介され|思われ|考えられ))/;
const DENIED = /(違います|違う|ちがい|ではありません|ではない|ではなく|誤り|間違い|当てはまりません|当てはまらない|そうではな|とは言えません|とは言えない)/;
const reportedAndDenied = (sentence, at, next) => {
  const close = sentence.slice(at).search(/[」』]/);
  if (close < 0) return false;
  const rest = sentence.slice(at + close);
  // Denied in words, or answered by what follows ("…という見方もありますが、この期間は…").
  return REPORTED.test(rest) && (DENIED.test(rest) || /(が、|けれど|ものの|しかし)/.test(rest) || DENIED.test(next ?? "") || /^(しかし|ただ|でも|実際)/.test((next ?? "").trim()));
};

// A claim about the inside-first order of the whole table: "内側から順に並んでいないところがあります" (not in order),
// "1コースから6コースまで内側から順に高くなっています" (in order). Limited to part of the courses ("外側では…"), it is not
// read. A question or a guess is uncertain (shown for review if the data says otherwise, never blocking).
// The same claim told from the outer courses: "外のコースが内側のコースを上回るところがなかった" (in order) /
// "外のコースが内側のコースを上回るところがあります" (not in order).
const OUTER_ABOVE = /外(?:側)?の(?:コース)?(?:が|は)内側の(?:コース)?(?:を|より)(?:上回|高く?な)(?:る|った|っている)?(?:ところ|部分|箇所|コース)?(?:は|が)(ない|なかった|ありません|ありませんでした|ある|あった|あります|ありました)/;
function orderClaim(sentence, extended = false) {
  const SEQ = extended ? SEQUENCE_V5 : SEQUENCE, YES = extended ? SEQUENCE_YES_V5 : SEQUENCE_YES;
  const outer = OUTER_ABOVE.exec(sentence);
  if (outer && !QUESTION.test(sentence.trim())) {
    const inOrderClaim = /^な|^ありません/.test(outer[1]);
    return { kind: "sequence", key: inOrderClaim ? "sequence:in" : "sequence:out", text: outer[0], sentence, inOrder: inOrderClaim, certain: !HEDGE.test(sentence.trim()) };
  }
  const m = SEQ.exec(sentence);
  if (!m) return null;
  const before = sentence.slice(0, m.index), after = sentence.slice(m.index + m[0].length);
  if (partial(before)) return null;
  const rest = after.split(/[、,]/)[0];
  const no = SEQUENCE_NOT.test(rest), yes = YES.test(rest);
  if ((!no && !yes) || QUESTION.test(sentence.trim())) return null;
  const inOrderClaim = !no;
  // An "in order" reading with a negation the patterns do not know ("…並ぶとはいえない") is left uncertain: a wrongly
  // read negation must never block approval.
  const unknownNegation = inOrderClaim && /(ない|なく|ません|ず[、。]?$|ぬ)/.test(rest);
  const claim = { kind: "sequence", key: inOrderClaim ? "sequence:in" : "sequence:out", text: m[0] + rest, sentence, inOrder: inOrderClaim,
    certain: !HEDGE.test(sentence.trim()) && !unknownNegation };
  // PHASE 5.2 (version 5): which way the order runs is read only from "外側のコースほど…低い" / "内側のコースほど…高い" (and
  // the reverse, which is wrong). "内側から順番どおりに並んでいる" or "内側から順に高く" says no way for certain: it is still
  // checked as an in-order claim, but it never confirms the finding (directionless).
  if (extended && inOrderClaim) {
    const from = /外側(?:のコース)?(?:へ向かう|に向かう)?ほど|内側(?:のコース)?から外側/.test(m[0]) ? "outside" : /内側(?:のコース)?ほど/.test(m[0]) ? "inside" : null;
    const dir = /低|下が/.test(rest) ? "低" : /高|上が/.test(rest) ? "高" : null;
    if (!from || !dir) claim.directionless = true;
    else if ((from === "outside") === (dir === "高")) claim.inverted = true;
  }
  return claim;
}

// [{ kind, key, text, sentence, course, other?, dir?, rank? }]; key matches the readings' keys.
// context: the whole text is about the 1着率 (a dialogue whose question names it), so each sentence need not.
// extended: the article's source pack is version 5 or later (PHASE 5.0 patterns and statements; see above).
export function rateStatements(text, facts = [], { context = false, extended = false } = {}) {
  const values = courseRateTables(facts).flatMap(t => t.rates.map(r => r.text));
  // An order sentence often names no rate itself ("高い順に見ると、…"); the text around it does.
  const aboutRates = /1着率/.test(norm(text));
  const blockAboutRates = extended && (rateContext(norm(text), values) || RATE_DEFINED_V5.test(norm(text)));
  const out = [];
  const parts = norm(text).split(/[。！？\n]/);
  for (const [index, raw] of parts.entries()) {
    const next = parts[index + 1];
    const own = context || rateContext(raw, values) || (extended && RATE_DEFINED_V5.test(raw));
    // A sentence read only through its block is a reading in context, never stated for certain (shown for review).
    const inherited = !own && blockAboutRates && !OTHER_METRIC.test(raw) && !TOPIC_SHIFT.test(raw);
    const relevant = own || inherited;
    if (!relevant && !(aboutRates && ORDER.test(raw))) continue;
    ORDER.lastIndex = 0;
    let s = prepare(raw);
    if (extended) s = s.replace(UNDER_HALF_RACES_V5, "半分に届かない");
    // Set once the statements only this context lets us read are taken (the order and sequence claims before are read
    // as they always were).
    let contextOnly = false;
    // Each match is blanked out so a later, broader pattern cannot read the same words again.
    // Statements naming two courses blank their match out, so the second course cannot be read again as a
    // statement of its own ("1コース以外では4コースが最も高い" is not "4コースが最も高い").
    const take = (re, read, consume = true) => {
      s = s.replace(re, (...m) => {
        const offset = m[m.length - 2], whole = m[m.length - 1], after = whole.slice(offset + m[0].length);
        // Negated in its own clause: no statement. A negation earlier in the same clause ("3コースではなく…"): uncertain.
        if (NEGATION.test(m[0]) || NEGATION.test(clauseAfter(after))) return consume ? " ".repeat(m[0].length) : m[0];
        const before = whole.slice(0, offset);
        const st = read(m, before, after);
        if (st) out.push({ ...st, text: m[0], sentence: raw, certain: !NEGATION.test(clauseBefore(before)) && !(extended && (contextOnly || (insideQuote(before) && reportedAndDenied(whole, offset, next)))) });
        return consume ? " ".repeat(m[0].length) : m[0];
      });
    };
    take(ORDER, m => {
      const courses = m[2].match(/[1-6]/g).map(Number);
      return new Set(courses).size === courses.length ? { kind: "order", key: "order", dir: m[1] === "高い" ? "高" : "低", courses } : null;
    });
    if (!relevant && !(aboutRates && (extended ? SEQUENCE_V5 : SEQUENCE).test(raw))) continue;
    const sequence = orderClaim(raw, extended);
    // Version 5: an order claim quoted or told of another subject is shown for review only.
    const at = Math.max(0, raw.indexOf(sequence?.text ?? ""));
    if (sequence && extended && (TOPIC_SHIFT.test(raw) || (insideQuote(raw.slice(0, at)) && reportedAndDenied(raw, at, next)))) sequence.certain = false;
    if (sequence) out.push(sequence);
    if (!relevant) continue;
    contextOnly = inherited;
    take(EXCEPT_FIRST, m => ({ kind: "except", key: `except:${m[1]}:${m[2]}`, course: Number(m[1]), dir: m[2] }));
    take(EXCEPT_LEAD, m => ({ kind: "except", key: `except:${m[1]}:${m[2]}`, course: Number(m[1]), dir: m[2] }));
    take(NEAR_PAIR, m => m[1] === m[2] ? null : { kind: "near", key: `near:${Math.min(m[1], m[2])}:${Math.max(m[1], m[2])}`, course: Number(m[1]), other: Number(m[2]) });
    if (extended) take(NEAR_FIGURES, m => m[1] === m[2] ? null : { kind: "near", key: `near:${Math.min(m[1], m[2])}:${Math.max(m[1], m[2])}`, course: Number(m[1]), other: Number(m[2]) });
    take(PAIRWISE, m => {
      if (m[1] === m[2]) return null;
      const [hi, lo] = ["高", "上回", "上"].includes(m[3]) ? [m[1], m[2]] : [m[2], m[1]];
      return { kind: "pair", key: `pair:${hi}>${lo}`, course: Number(hi), other: Number(lo) };
    });
    take(ORDINAL, (m, before, after) => partial(before + m[2]) || LIMITED_AFTER.test(after) ? null : { kind: "ordinal", key: `ordinal:${m[1]}:${m[3]}:${m[4]}`, course: Number(m[1]), rank: Number(m[3]), dir: m[4] });
    // Version 5 leaves the below-half words in place, so "最も高い" in the same sentence is still read (the contrast).
    take(extended ? UNDER_HALF_V5 : UNDER_HALF, m => ({ kind: "under_half", key: `under_half:${m[1]}`, course: Number(m[1]) }), !extended);
    if (extended) {
      // Two courses said to be close ("差は小さい") or equal ("差がない", "同じ値"); "ほぼ同じ" stays a near tie.
      take(CLOSE_PAIR, m => m[1] === m[2] ? null : { kind: "close", key: `close:${Math.min(m[1], m[2])}:${Math.max(m[1], m[2])}`, course: Number(m[1]), other: Number(m[2]) }, false);
      take(CLOSE_FIGURES, m => m[1] === m[2] ? null : { kind: "close", key: `close:${Math.min(m[1], m[2])}:${Math.max(m[1], m[2])}`, course: Number(m[1]), other: Number(m[2]) }, false);
      take(EQUAL_PAIR, m => m[1] === m[2] ? null : { kind: "equal", key: `equal:${Math.min(m[1], m[2])}:${Math.max(m[1], m[2])}`, course: Number(m[1]), other: Number(m[2]) }, false);
    }
    take(extended ? HALF_V5 : HALF, m => ({ kind: "half", key: `half:${m[1]}`, course: Number(m[1]) }), false);
    take(SUPERLATIVE, (m, before, after) => partial(before + m[2]) || LIMITED_AFTER.test(after) ? null : { kind: "top", key: `top:${m[1]}:${m[3]}`, course: Number(m[1]), dir: m[3] });
    // "1コースは最も高い…なのに、半分に届かない": both parts in one sentence tell the contrast (each is checked on its own).
    const here = out.filter(st => st.sentence === raw).map(st => st.key);
    if (extended && here.includes("top:1:高") && here.includes("under_half:1"))
      out.push({ kind: "contrast", key: "contrast:1", text: raw, sentence: raw, certain: out.filter(st => st.sentence === raw && ["top:1:高", "under_half:1"].includes(st.key)).every(st => st.certain !== false) });
  }
  return out;
}

// What is wrong with one statement against one table, or null. Near ties are a judgement, not a fact, so they
// never count as wrong; neither does a rank or an order when two values are equal.
function wrongAgainst(st, rates) {
  const at = c => rates[c - 1], rank = ranks(rates), text = `「${st.text.trim()}」`;
  const word = st.dir === "高" ? "高い" : "低い";
  if (st.kind === "top") {
    const extreme = unique(rates, st.dir === "高" ? Math.max : Math.min);
    return extreme && extreme.course !== st.course ? `${text}（最も${word}のは${extreme.course}コース）` : null;
  }
  if (st.kind === "except") {
    const extreme = unique(rates.slice(1), st.dir === "高" ? Math.max : Math.min);
    return extreme && extreme.course !== st.course ? `${text}（1コース以外で最も${word}のは${extreme.course}コース）` : null;
  }
  if (st.kind === "pair") {
    const [lo, hi] = [st.course, st.other].sort();
    return at(st.course).value < at(st.other).value ? `${text}（${lo}コース${at(lo).text}%、${hi}コース${at(hi).text}%）` : null;
  }
  if (st.kind === "half") return at(st.course).value <= 50 ? `${text}（${st.course}コース${at(st.course).text}%）` : null;
  if (st.kind === "under_half") return at(st.course).value >= 50 ? `${text}（${st.course}コース${at(st.course).text}%）` : null;
  if (st.kind === "equal") return at(st.course).value !== at(st.other).value ? `${text}（${st.course}コース${at(st.course).text}%、${st.other}コース${at(st.other).text}%で同じではありません）` : null;
  if (st.kind === "close") return Math.abs(at(st.course).value - at(st.other).value) > CLOSE ? `${text}（${st.course}コース${at(st.course).text}%、${st.other}コース${at(st.other).text}%）` : null;
  if (st.kind === "sequence") {
    const actual = inOrder(rates);
    const values = rates.map(r => `${r.course}コース${r.text}%`).join("、");
    // A near tie between neighbours leaves either claim a judgement: never wrong.
    if (actual === null) return null;
    if (st.inOrder && !actual) return `${text}（内側から順ではありません：${values}）`;
    if (st.inOrder && st.inverted) return `${text}（1着率は内側のコースほど高く、外側のコースほど低くなっています：${values}）`;
    if (!st.inOrder && actual) return `${text}（1コースから6コースまで内側から順に高くなっています：${values}）`;
    return null;
  }
  if (!rank) return null;
  if (st.kind === "ordinal") {
    const actual = st.dir === "高" ? rank.get(st.course) : 7 - rank.get(st.course);
    return actual !== st.rank ? `${text}（${st.course}コースは${word}方から${actual}番目）` : null;
  }
  if (st.kind === "order") {
    const actual = [...rates].sort((a, b) => (st.dir === "高" ? b.value - a.value : a.value - b.value)).map(r => r.course);
    return st.courses.some((c, i) => actual[i] !== c) ? `${text}（${word}順は${actual.map(c => `${c}コース`).join("→")}）` : null;
  }
  return null;
}

// Comparisons checked against the data: { certain, unclear } lists of messages.
// certain (blocks approval): a clear statement that contradicts the data whatever table it speaks of.
// unclear (shown for review): it contradicts the data, but the sentence also negates something, or the facts hold
// several periods and it contradicts only some of them.
export function comparisonFindings(text, facts = [], options = {}) {
  const tables = courseRateTables(facts);
  const certain = [], unclear = [];
  if (!tables.length) return { certain, unclear };
  for (const st of rateStatements(text, facts, options)) {
    const wrong = tables.map(t => wrongAgainst(st, t.rates));
    // "差は小さい" is a judgement against an editorial margin: shown for review, never blocking.
    if (st.kind === "close") st.certain = false;
    // Source packs from version 5 (options.extended): "ほぼ同じ" is kept for neighbours more than 0 and at most NEAR
    // apart. Wider apart, or the same value ("同じ値" then), it is shown for review (an editorial convention, never blocking).
    if (st.kind === "near" && options.extended) {
      const far = tables.map(t => {
        const x = t.rates[st.course - 1], y = t.rates[st.other - 1], gap = Math.abs(x.value - y.value);
        const figures = `${st.course}コース${x.text}%、${st.other}コース${y.text}%`;
        return gap > NEAR ? `「${st.text.trim()}」（${figures}。「ほぼ同じ」は差が0.5ポイント以内のときに使います）`
          : gap === 0 ? `「${st.text.trim()}」（${figures}。同じ値なので「同じ値」と書きます）` : null;
      });
      if (far.every(Boolean)) unclear.push(far[0]);
      continue;
    }
    const first = wrong.find(Boolean);
    if (!first) continue;
    const everyTable = wrong.every(Boolean);
    if (st.certain && everyTable) certain.push(tables.length > 1 ? `${first}（どの集計期間の値とも合いません）` : first);
    else unclear.push(everyTable ? first : `${first}（集計期間によって合わない値があります）`);
  }
  return { certain, unclear };
}

// Statements that certainly contradict the data (exactly one complete table, or every table when there are several).
export const comparisonMismatches = (text, facts = [], options = {}) => comparisonFindings(text, facts, options).certain;

// A course-rate table whose cells disagree with the facts (e.g. the system table edited by hand): rows of the form
// ["Nコース", "x%"] are compared with the one certain table. Other tables are left alone.
export function tableMismatches(rows = [], facts = []) {
  const table = rateTable(facts);
  if (!table) return [];
  const out = [];
  for (const row of rows) {
    const course = /^([1-6])コース$/.exec(norm(row[0]).trim());
    const value = /^(\d+(?:\.\d+)?)\s*[%％]?$/.exec(norm(row[1] ?? "").trim());
    if (!course || !value) continue;
    const fact = table.rates[Number(course[1]) - 1];
    if (Number(value[1]) !== fact.value) out.push(`${course[1]}コース「${norm(row[1]).trim()}」（公式データ ${fact.text}%）`);
  }
  return out;
}

// ---- The source a statement without numbers rests on ----
const GENERIC = new Set(["なし", "あり", "有", "無"]);
// A dialogue is about the 1着率 as a whole when one of its lines names it.
export const dialogueContext = block => ({ context: block.type === "DIALOGUE_SCENE" && (block.data.turns || []).some(t => /1着率/.test(norm(t.text))) });

// Source ids for the rate statements and non-numeric facts (水質「海水」, レース時間帯「デイ」…) a text states.
export function statementSourceIds(text, pack) {
  const ids = new Set(), facts = pack.facts || [], stadium = pack.stadium?.name;
  const tables = courseRateTables(facts);
  if (tables.length === 1 && rateStatements(text, facts, { extended: (pack.version ?? 0) >= 5 }).length) ids.add(tables[0].source_id);
  for (const sentence of norm(text).split(/[。！？\n]/)) {
    for (const f of facts) {
      const value = norm(f.value).trim();
      if (!value || /^\d/.test(value)) continue;
      const topic = norm(f.label).replace(stadium ? `${stadium}の` : "", "");
      const named = sentence.includes(topic) || sentence.includes(topic.replace(/^レース/, ""));
      if (sentence.includes(value) && (named || !GENERIC.has(value))) ids.add(f.source_id);
    }
  }
  return [...ids];
}
