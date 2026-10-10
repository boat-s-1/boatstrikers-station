import { norm } from "./claims.mjs";

// What the course rates of one period say on their face, computed from the facts so the AI can explain the
// numbers without inventing comparisons. Readings only rank and compare recorded values; they never compute a
// new number (no differences, ratios or sums).

const RATE_LABEL = /^(.+)の([1-6])コース1着率$/;
const NEAR = 0.5; // values this close are described as "ほぼ同じ水準"
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
// Rank of each course among the six (1 = highest), only when every value differs.
const ranks = rates => new Set(rates.map(r => r.value)).size === rates.length
  ? new Map([...rates].sort((a, b) => b.value - a.value).map((r, i) => [r.course, i + 1])) : null;

// Readings: { id, key, kind, source_id, period, text, featured }. key identifies the statement, so an article's
// sentences can be matched to it (see rateStatements).
export function courseReadings(facts = []) {
  let n = 0;
  return courseRateTables(facts).flatMap(table => {
    const out = [], rates = table.rates, at = c => rates[c - 1];
    const add = (kind, key, text) => out.push({ id: `R${++n}`, key, kind, source_id: table.source_id, period: table.period, text, featured: false });
    const top = unique(rates, Math.max), bottom = unique(rates, Math.min);
    if (top) add("top", `top:${top.course}:高`, `${top.course}コースの1着率（${top.text}%）が6つのコースの中で最も高い`);
    if (top && top.value > 50) add("half", `half:${top.course}`, `${top.course}コースの1着率（${top.text}%）は半分を超えている`);
    if (bottom) add("bottom", `top:${bottom.course}:低`, `${bottom.course}コースの1着率（${bottom.text}%）が最も低い`);
    if (top?.course === 1) {
      const second = unique(rates.slice(1), Math.max);
      if (second) add("except_top", `except:${second.course}:高`, `${second.course}コースの1着率（${second.text}%）は1コース以外で最も高い`);
    }
    for (let c = 1; c < 6; c++) {
      const [a, b] = [at(c), at(c + 1)];
      if (Math.abs(a.value - b.value) <= NEAR) {
        const higher = a.value === b.value ? "同じ値" : `わずかに${(a.value > b.value ? a : b).course}コースが高い`;
        add("near", `near:${a.course}:${b.course}`, `${a.course}コース（${a.text}%）と${b.course}コース（${b.text}%）の1着率はほぼ同じ水準（${higher}）`);
      } else if (b.value > a.value) {
        // An outer course above the inner one next to it: the order is not simply "inside first".
        add("reversal", `pair:${b.course}>${a.course}`, `${b.course}コースの1着率（${b.text}%）は${a.course}コース（${a.text}%）より高い`);
      }
    }
    if (ranks(rates)) add("order", "order", `1着率の高い順：${[...rates].sort((a, b) => b.value - a.value).map(r => `${r.course}コース`).join("→")}`);
    // The 2〜3 readings most useful to a reader: the leading course, what breaks the inside-first order and the
    // best of the rest; then near ties and the lowest.
    const pick = [
      out.find(r => r.kind === "half") ?? out.find(r => r.kind === "top"),
      out.find(r => r.kind === "reversal"),
      out.find(r => r.kind === "except_top"),
      out.find(r => r.kind === "near"),
      out.find(r => r.kind === "bottom"),
    ].filter(Boolean).slice(0, MAX_FEATURED);
    for (const r of pick) r.featured = true;
    return out;
  });
}

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
const NEGATION = /(ではない|ではありません|とは限|わけではない|わけではありません|とは言えない|とは言えません|ことはない|ことはありません|ではなく|わけでもな)/;
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

// [{ kind, key, text, sentence, course, other?, dir?, rank? }]; key matches the readings' keys.
// context: the whole text is about the 1着率 (a dialogue whose question names it), so each sentence need not.
export function rateStatements(text, facts = [], { context = false } = {}) {
  const values = courseRateTables(facts).flatMap(t => t.rates.map(r => r.text));
  // An order sentence often names no rate itself ("高い順に見ると、…"); the text around it does.
  const aboutRates = /1着率/.test(norm(text));
  const out = [];
  for (const raw of norm(text).split(/[。！？\n]/)) {
    const relevant = context || rateContext(raw, values);
    if (!relevant && !(aboutRates && ORDER.test(raw))) continue;
    ORDER.lastIndex = 0;
    let s = prepare(raw);
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
        if (st) out.push({ ...st, text: m[0], sentence: raw, certain: !NEGATION.test(clauseBefore(before)) });
        return consume ? " ".repeat(m[0].length) : m[0];
      });
    };
    take(ORDER, m => {
      const courses = m[2].match(/[1-6]/g).map(Number);
      return new Set(courses).size === courses.length ? { kind: "order", key: "order", dir: m[1] === "高い" ? "高" : "低", courses } : null;
    });
    if (!relevant) continue;
    take(EXCEPT_FIRST, m => ({ kind: "except", key: `except:${m[1]}:${m[2]}`, course: Number(m[1]), dir: m[2] }));
    take(EXCEPT_LEAD, m => ({ kind: "except", key: `except:${m[1]}:${m[2]}`, course: Number(m[1]), dir: m[2] }));
    take(NEAR_PAIR, m => m[1] === m[2] ? null : { kind: "near", key: `near:${Math.min(m[1], m[2])}:${Math.max(m[1], m[2])}`, course: Number(m[1]), other: Number(m[2]) });
    take(PAIRWISE, m => {
      if (m[1] === m[2]) return null;
      const [hi, lo] = ["高", "上回", "上"].includes(m[3]) ? [m[1], m[2]] : [m[2], m[1]];
      return { kind: "pair", key: `pair:${hi}>${lo}`, course: Number(hi), other: Number(lo) };
    });
    take(ORDINAL, (m, before, after) => partial(before + m[2]) || LIMITED_AFTER.test(after) ? null : { kind: "ordinal", key: `ordinal:${m[1]}:${m[3]}:${m[4]}`, course: Number(m[1]), rank: Number(m[3]), dir: m[4] });
    take(HALF, m => ({ kind: "half", key: `half:${m[1]}`, course: Number(m[1]) }), false);
    take(SUPERLATIVE, (m, before, after) => partial(before + m[2]) || LIMITED_AFTER.test(after) ? null : { kind: "top", key: `top:${m[1]}:${m[3]}`, course: Number(m[1]), dir: m[3] });
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
  if (tables.length === 1 && rateStatements(text, facts).length) ids.add(tables[0].source_id);
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
