import { createHash } from "node:crypto";
import { assessRace, usableFor, exclusionReasons, raceKey, genderMap } from "./raceQuality.mjs";

// Research datasets for the three characters (PHASE 1). Each definition counts confirmed races only, after the
// race-level gate in raceQuality.mjs. The result (an "evidence" object) carries everything needed to check the
// article later: period, scope, population, usable races, exclusions by reason, metrics and a hash of all of them.
// Numbers in an article may only come from these metrics (they become source-pack facts).

export const DATASET_VERSION = 1;
export const DEFAULT_THRESHOLDS = { minSample: 100, minCoverage: 0.95 };
export const HIGH_PAYOUT_YEN = 10000; // 3連単1万円以上 (the definition of 高配当 until the editors decide otherwise)

const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null);
const median = values => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export const DATASETS = {
  inside_escape: {
    label: "イン逃げ率", character: "ichika", needs: ["result", "course"],
    include: () => true,
    metrics(races) {
      const escapes = races.filter(r => r.fields.winner_course === 1 && r.fields.technique === "逃げ").length;
      return { races: races.length, escapes, escape_rate: pct(escapes, races.length) };
    },
    facts: (m, scope) => [
      [`${scope}のイン逃げ率`, m.escape_rate, "%"], [`${scope}のイン逃げ件数`, m.escapes, "レース"], [`${scope}の集計レース数`, m.races, "レース"],
    ],
  },
  women_inside_escape: {
    label: "女子戦のイン逃げ率と決まり手", character: "hatsune", needs: ["result", "course", "gender"],
    // Women's races are races where all six entrants are female in racer_gender_master. Races with an unknown
    // or conflicting entrant could be women's races, so they are counted against coverage, never as mixed races.
    include: r => r.fields.all_female === true,
    candidate: r => r.fields.all_female !== false,
    metrics(races) {
      const escapes = races.filter(r => r.fields.winner_course === 1 && r.fields.technique === "逃げ").length;
      const techniques = {};
      for (const r of races) techniques[r.fields.technique] = (techniques[r.fields.technique] || 0) + 1;
      return { races: races.length, escapes, escape_rate: pct(escapes, races.length), techniques };
    },
    facts: (m, scope) => [
      [`${scope}の女子戦のイン逃げ率`, m.escape_rate, "%"], [`${scope}の女子戦のイン逃げ件数`, m.escapes, "レース"], [`${scope}の女子戦の集計レース数`, m.races, "レース"],
      ...Object.entries(m.techniques).map(([t, n]) => [`${scope}の女子戦の決まり手「${t}」の件数`, n, "レース"]),
    ],
  },
  boat5_win: {
    label: "5号艇の1着率", character: "kiina", needs: ["result"],
    include: () => true,
    metrics(races) {
      const wins = races.filter(r => r.fields.first_boat === 5).length;
      return { races: races.length, boat5_wins: wins, boat5_win_rate: pct(wins, races.length) };
    },
    facts: (m, scope) => [
      [`${scope}の5号艇1着率`, m.boat5_win_rate, "%"], [`${scope}の5号艇1着の件数`, m.boat5_wins, "レース"], [`${scope}の集計レース数`, m.races, "レース"],
    ],
  },
  high_payout: {
    label: "高配当（3連単1万円以上）の発生率", character: "kiina", needs: ["result", "payout"],
    include: () => true,
    metrics(races, params) {
      const threshold = params.threshold ?? HIGH_PAYOUT_YEN;
      const high = races.filter(r => r.fields.payout >= threshold);
      return { races: races.length, threshold, high_count: high.length, high_rate: pct(high.length, races.length),
        median_payout: median(races.map(r => r.fields.payout)), boat5_in_high: high.filter(r => r.fields.first_boat === 5).length };
    },
    facts: (m, scope) => [
      [`${scope}の3連単${m.threshold}円以上の発生率`, m.high_rate, "%"], [`${scope}の3連単${m.threshold}円以上の件数`, m.high_count, "レース"],
      [`${scope}の3連単払戻金の中央値`, m.median_payout, "円"], [`${scope}の集計レース数`, m.races, "レース"],
      [`${scope}の高配当のうち5号艇1着の件数`, m.boat5_in_high, "レース"],
    ],
  },
};

// The research period always ends on the previous day in JST, so only finished race days are counted.
export function jstDay(date) {
  return new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
export function researchPeriod({ now = new Date(), days = 365 }) {
  if (!Number.isInteger(days) || days < 7 || days > 731) throw Object.assign(new Error("集計期間は7〜731日で指定してください。"), { status: 400 });
  const today = new Date(`${jstDay(now)}T00:00:00Z`);
  const end = new Date(today.getTime() - 86400000), start = new Date(end.getTime() - (days - 1) * 86400000);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), days };
}
export const displayPeriod = p => `${p.from.replaceAll("-", "/")}〜${p.to.replaceAll("-", "/")}`;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export const evidenceHash = e => createHash("sha256").update(JSON.stringify(canonical({
  definition: e.definition, version: e.version, params: e.params, period: e.period, population: e.population, usable: e.usable,
  excluded: e.excluded, metrics: e.metrics }))).digest("hex");

// rows: { results, events, entries, genders } as read from the database (see reader.mjs).
// params: { course_code?: number, scope_name: string, threshold?: number }.
export function computeDataset({ definition, rows, period, params = {}, now = new Date(), thresholds = DEFAULT_THRESHOLDS }) {
  const def = DATASETS[definition];
  if (!def) throw Object.assign(new Error(`未定義の集計です：${definition}`), { status: 400 });
  const issues = [];
  const today = jstDay(now);
  if (period.to >= today) issues.push({ code: "period_not_finished", message: "集計期間に当日以降が含まれています。確定した日だけを集計してください。" });

  const inScope = r => r.race_date >= period.from && r.race_date <= period.to && (params.course_code === undefined || Number(r.course_code) === Number(params.course_code));
  const genders = genderMap(rows.genders);
  const resultsByKey = new Map(), eventsByKey = new Map(), entriesByKey = new Map();
  for (const r of (rows.results || []).filter(inScope)) {
    const key = raceKey(r);
    if (resultsByKey.has(key)) issues.push({ code: "duplicate_result", message: `同じレースの結果が複数あります（${key}）。` });
    resultsByKey.set(key, r);
  }
  for (const e of (rows.events || []).filter(inScope)) eventsByKey.set(raceKey(e), e);
  for (const e of (rows.entries || []).filter(inScope)) { const k = raceKey(e); if (!entriesByKey.has(k)) entriesByKey.set(k, []); entriesByKey.get(k).push(e); }

  // Population: every race of the scope known to either table, except races recorded as cancelled with no result.
  const keys = new Set([...resultsByKey.keys(), ...eventsByKey.keys()]);
  const excluded = {}, usableRaces = [];
  let population = 0;
  for (const key of [...keys].sort()) {
    const event = eventsByKey.get(key) || null, result = resultsByKey.get(key) || null;
    if (!result && event && (event.race_cancel_code || event.race_status === "cancelled")) continue;
    const a = assessRace({ result, event, entries: entriesByKey.get(key) || [], genders });
    const usable = usableFor(a, def.needs);
    // For a filtered dataset (women's races) only possible members count: a clean mixed race is not part of it.
    const candidate = usable ? def.include(a) : (def.candidate ? def.candidate(a) : true);
    if (!candidate) continue;
    population++;
    if (usable) usableRaces.push(a);
    else for (const reason of exclusionReasons(a, def.needs)) excluded[reason] = (excluded[reason] || 0) + 1;
  }
  const metrics = def.metrics(usableRaces, params);
  const coverage = population ? Math.round((10000 * usableRaces.length) / population) / 10000 : 0;
  if (!population) issues.push({ code: "no_races", message: "集計期間・対象にレースがありません。" });
  else {
    if (usableRaces.length < thresholds.minSample) issues.push({ code: "insufficient_sample", message: `集計できるレースが${usableRaces.length}件で、最低${thresholds.minSample}件に届きません。` });
    if (coverage < thresholds.minCoverage) issues.push({ code: "low_coverage", message: `集計できたレースが対象の${(coverage * 100).toFixed(1)}%で、基準の${thresholds.minCoverage * 100}%を下回ります。欠損・不整合のあるデータが多すぎます。` });
  }
  const evidence = {
    definition, version: DATASET_VERSION, label: def.label, character: def.character,
    params: { ...params }, period: { from: period.from, to: period.to }, computed_at: now.toISOString(),
    population, usable: usableRaces.length, excluded, coverage, metrics, thresholds: { ...thresholds },
    status: issues.length ? "hold" : "ok", issues,
  };
  evidence.hash = evidenceHash(evidence);
  return evidence;
}

// A usable dataset becomes one source and its facts. A dataset that is not "ok" is never turned into facts.
export function datasetSource(evidence, { id = "D1" } = {}) {
  if (evidence.status !== "ok") throw Object.assign(new Error("品質基準を満たさない集計は記事に使えません。"), { status: 422, issues: evidence.issues });
  const scope = evidence.params.scope_name || "全国";
  const period = displayPeriod(evidence.period);
  const source = { id, kind: "boatstrikers_dataset", label: `BoatStrikers集計（${evidence.label}・${scope}・${period}・確定結果）`,
    url: "/data-lab", fetched_at: evidence.computed_at, period, dataset: evidence.definition, dataset_hash: evidence.hash,
    population: evidence.population, usable: evidence.usable, excluded: evidence.excluded };
  let n = 0;
  const facts = DATASETS[evidence.definition].facts(evidence.metrics, scope)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([label, value, unit]) => ({ id: `${id}F${++n}`, source_id: id, label, value: String(value), unit, period }));
  facts.push({ id: `${id}F${++n}`, source_id: id, label: `${scope}の対象レース数（除外前）`, value: String(evidence.population), unit: "レース", period });
  return { source, facts };
}

// Recompute and compare at gate time: the stored hash must still describe the data. Any difference is a HOLD.
export function recheckDataset({ stored, recomputed }) {
  if (!stored || !recomputed) return { ok: false, code: "dataset_missing" };
  if (stored.hash !== evidenceHash(stored)) return { ok: false, code: "dataset_tampered" };
  if (recomputed.status !== "ok") return { ok: false, code: "dataset_no_longer_ok" };
  if (recomputed.hash !== stored.hash) return { ok: false, code: "dataset_changed" };
  return { ok: true };
}
