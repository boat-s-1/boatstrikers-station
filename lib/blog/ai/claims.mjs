// Numbers and dates written in an article, and the evidence each source provides for them.
// Dates are read as whole dates ("2026年5月1日", "2026/05/01", "7月31日", "2026年5月") so their parts are never
// checked as separate numbers; each must match a period or retrieval date recorded for the cited source.

const SMALL_INT_UNITS = /^(コース|号艇|艇|R|レース|着|マーク|周|人|位|番|つ|か所|カ所|点|個|項目|場)/;
export const NUMBER = /\d+(?:[.,]\d+)*/g;
// Alternatives are tried left to right at each position: full dates first, then year+month, month+day, month, year.
const DATE = /(?<![\d.,/-])(?:(\d{4})年(\d{1,2})月(\d{1,2})日|(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?![\d.])|(\d{4})年(\d{1,2})月|(\d{1,2})月(\d{1,2})日|(\d{1,2})月|(\d{4})年)/g;

export const pad = n => String(n).padStart(2, "0");
export const norm = text => String(text ?? "").normalize("NFKC");

function numberForms(raw) {
  const plain = raw.replace(/,/g, "");
  const out = new Set([raw, plain]);
  if (/^\d+\.\d+$/.test(plain)) out.add(String(Number(plain)));
  return out;
}

function validDate(y, m, d) {
  return m >= 1 && m <= 12 && (d === undefined || (d >= 1 && d <= 31)) && (y === undefined || (y >= 1900 && y <= 2100));
}

// [{ kind: "date", label, year?, month?, day? } | { kind: "number", label, forms }]
export function claimsIn(text) {
  let rest = norm(text);
  const out = [];
  let year;
  rest = rest.replace(DATE, (all, y1, m1, d1, y2, m2, d2, y3, m3, m4, d4, m5, y6) => {
    const n = v => (v === undefined ? undefined : Number(v));
    let claim;
    if (y1 || y2) claim = { year: n(y1 ?? y2), month: n(m1 ?? m2), day: n(d1 ?? d2) };
    else if (y3) claim = { year: n(y3), month: n(m3) };
    else if (m4) claim = { year, month: n(m4), day: n(d4) };
    else if (m5) claim = { year, month: n(m5) };
    else claim = { year: n(y6) };
    if (claim.month !== undefined && !validDate(claim.year, claim.month, claim.day)) return all;
    if (claim.month === undefined && !validDate(claim.year, 1)) return all;
    if (y1 || y2 || y3 || y6) year = claim.year;
    out.push({ kind: "date", label: all, ...claim });
    return " ".repeat(all.length);
  });
  for (const m of rest.matchAll(NUMBER)) {
    const value = m[0], after = rest.slice(m.index + value.length), plain = value.replace(/,/g, "");
    if (/^\d+$/.test(plain) && Number(plain) >= 1 && Number(plain) <= 12 && SMALL_INT_UNITS.test(after)) continue;
    if (plain === "24" && /^場/.test(after)) continue;
    out.push({ kind: "number", label: value, forms: numberForms(value) });
  }
  return out;
}

const PERIOD_DATES = /(\d{4})\/(\d{1,2})\/(\d{1,2})/g;
export function periodDates(period) {
  return [...norm(period).matchAll(PERIOD_DATES)].map(m => ({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }));
}
export const jstDate = iso => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

// A date claim matches a recorded date at the precision it was written with.
export function dateMatches(claim, date) {
  return (claim.year === undefined || claim.year === date.year) && (claim.month === undefined || claim.month === date.month)
    && (claim.day === undefined || claim.day === date.day);
}

// The period a fact belongs to: its own, or (for older packs) the period of a repository dataset source.
export function factPeriod(fact, source) {
  return fact.period ?? (source?.kind === "repository_dataset" ? source.period : null) ?? null;
}

// Evidence per source id: numbers and dates it supports. "context" numbers (topic hint, stadium code/count)
// are accepted under any citation, as before.
export function evidence(pack) {
  const sources = new Map((pack.sources || []).map(s => [s.id, s]));
  const by = new Map([...sources.keys()].map(id => [id, { numbers: new Set(), dates: [] }]));
  const addText = (id, text) => {
    const e = by.get(id); if (!e) return;
    for (const c of claimsIn(text)) {
      if (c.kind === "number") c.forms.forEach(f => e.numbers.add(f));
      else if (c.day !== undefined && c.year !== undefined) e.dates.push({ year: c.year, month: c.month, day: c.day });
    }
  };
  for (const s of sources.values()) {
    addText(s.id, s.label);
    by.get(s.id).dates.push(...periodDates(s.period));
    if (s.fetched_at) by.get(s.id).dates.push(jstDate(s.fetched_at));
  }
  const factPeriods = new Map();
  for (const f of pack.facts || []) {
    const e = by.get(f.source_id); if (!e) continue;
    addText(f.source_id, f.label);
    for (const form of numberForms(norm(f.value).trim())) e.numbers.add(form);
    for (const c of claimsIn(f.value)) if (c.kind === "number") c.forms.forEach(x => e.numbers.add(x));
    const period = factPeriod(f, sources.get(f.source_id));
    if (period) {
      const dates = periodDates(period);
      e.dates.push(...dates);
      for (const form of numberForms(norm(f.value).trim())) {
        if (!factPeriods.has(form)) factPeriods.set(form, []);
        factPeriods.get(form).push({ source_id: f.source_id, dates });
      }
    }
  }
  for (const d of pack.documents || []) { addText(d.source_id, d.title); addText(d.source_id, d.excerpt); }
  const context = new Set();
  for (const c of claimsIn(pack.topic?.title_hint)) if (c.kind === "number") c.forms.forEach(f => context.add(f));
  if (pack.stadium?.course_code) context.add(String(pack.stadium.course_code));
  if (pack.stadium_count) context.add(String(pack.stadium_count));
  return { sources, by, context, factPeriods };
}

// Source ids (in the given order) that support a claim.
export function supportingSources(claim, ev, ids = [...ev.by.keys()]) {
  return ids.filter(id => {
    const e = ev.by.get(id); if (!e) return false;
    return claim.kind === "number" ? [...claim.forms].some(f => e.numbers.has(f) || ev.context.has(f)) : e.dates.some(d => dateMatches(claim, d));
  });
}
