import { norm } from "./claims.mjs";

// What the course rates of one period say on their face, computed from the facts so the AI can explain the
// numbers without inventing comparisons. Readings only rank and compare recorded values; they never compute a
// new number (no differences, ratios or sums).

const RATE_LABEL = /^(.+)の([1-6])コース1着率$/;
const NEAR = 0.5; // values this close are described as "ほぼ同じ水準"

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

const unique = (rates, pick) => { const best = pick(...rates.map(r => r.value)); const hit = rates.filter(r => r.value === best); return hit.length === 1 ? hit[0] : null; };

export function courseReadings(facts = []) {
  let n = 0;
  return courseRateTables(facts).flatMap(table => {
    const out = [], add = text => out.push({ id: `R${++n}`, source_id: table.source_id, period: table.period, text });
    const top = unique(table.rates, Math.max), bottom = unique(table.rates, Math.min);
    if (top) add(`${top.course}コースの1着率（${top.text}%）が6つのコースの中で最も高い`);
    if (top && top.value > 50) add(`${top.course}コースの1着率（${top.text}%）は半分を超えている`);
    if (bottom) add(`${bottom.course}コースの1着率（${bottom.text}%）が最も低い`);
    for (let i = 0; i < 5; i++) {
      const [a, b] = [table.rates[i], table.rates[i + 1]];
      if (Math.abs(a.value - b.value) > NEAR) continue;
      const higher = a.value === b.value ? "同じ値" : `わずかに${(a.value > b.value ? a : b).course}コースが高い`;
      add(`${a.course}コース（${a.text}%）と${b.course}コース（${b.text}%）の1着率はほぼ同じ水準（${higher}）`);
    }
    return out;
  });
}

// Comparisons of course rates that contradict the data. Only sentences that name the course(s), speak of the
// 1着率 (or quote a rate value) and state a clear direction are checked; anything ambiguous is left alone.
const SUPERLATIVE = /([1-6])コース(?:の1着率)?(?:は|が)[^。、！？]{0,12}?(?:最も|一番|もっとも|いちばん)(高|低)/g;
const PAIRWISE = /([1-6])コース(?:の1着率)?(?:は|が)[^。！？]{0,10}?([1-6])コース(?:の1着率)?(?:より|を)(?:も)?[^。！？]{0,6}?(高|低|上回|下回)/g;

export function comparisonMismatches(text, facts = []) {
  const tables = courseRateTables(facts);
  if (tables.length !== 1) return []; // with several periods the sentence's table cannot be identified for sure
  const rates = new Map(tables[0].rates.map(r => [r.course, r]));
  const out = [];
  for (const sentence of norm(text).split(/[。！？\n]/)) {
    if (!/1着率/.test(sentence) && !tables[0].rates.some(r => sentence.includes(`${r.text}%`))) continue;
    if (/(ではない|ではありません|とは限|わけではない|わけではありません)/.test(sentence)) continue;
    for (const m of sentence.matchAll(SUPERLATIVE)) {
      const claimed = rates.get(Number(m[1])), extreme = unique(tables[0].rates, m[2] === "高" ? Math.max : Math.min);
      if (extreme && claimed.course !== extreme.course) out.push(`「${m[0]}」（最も${m[2] === "高" ? "高い" : "低い"}のは${extreme.course}コース）`);
    }
    for (const m of sentence.matchAll(PAIRWISE)) {
      const [a, b] = [rates.get(Number(m[1])), rates.get(Number(m[2]))];
      if (!a || !b || a.course === b.course || a.value === b.value) continue;
      const saysHigher = ["高", "上回"].includes(m[3]);
      if (saysHigher !== a.value > b.value) out.push(`「${m[0]}」（${a.course}コース${a.text}%、${b.course}コース${b.text}%）`);
    }
  }
  return out;
}
