// PHASE 2 real-data check. Reads an export made with ops/blog/ai-real-data-export.sql and the output of
// ops/blog/ai-real-data-verification.sql for the same period/scope, runs computeDataset() on the exported rows and
// compares population, usable races, exclusions and metrics. Exit code 1 on any difference.
//   node scripts/blog/verify-real-data.mjs <export.json> <sql-output.json> <from> <to> <course_code|all> <definition>[,<definition>...]
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { computeDataset } from "../../lib/blog/ai/data/datasets.mjs";

export function decodeExport(exported) {
  const results = [], events = [], entries = [];
  for (const r of exported.races || []) {
    const [race_date, course_code, race_no, hasResult, result_status, trifecta_result, winning_trifecta, first_boat, trifecta_payout, technique,
      hasEvent, race_status, race_cancel_code, trifecta, event_payout, packed] = r;
    const key = { race_date, course_code, race_no };
    if (hasResult) results.push({ ...key, result_status, trifecta_result, winning_trifecta, first_boat, trifecta_payout, winning_technique: technique, winning_method: technique });
    if (hasEvent) events.push({ ...key, race_status, race_cancel_code, trifecta, trifecta_payout: event_payout });
    for (const e of packed ? packed.split("|") : []) {
      const [boat, reg, course, arrival, gc] = e.split(":");
      entries.push({ ...key, boat_no: Number(boat), racer_registration_no: reg || null, actual_course: course === "" ? null : Number(course),
        arrival_order: arrival === "" ? null : Number(arrival), gender_code: gc === "" ? null : gc });
    }
  }
  const genders = Object.entries(exported.genders || {}).map(([racer_id, racer_gender]) => ({ racer_id: Number(racer_id), racer_gender }));
  return { results, events, entries, genders };
}

export function compare({ evidence, sqlRow }) {
  const diffs = [];
  const same = (label, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push({ label, code: a, sql: b }); };
  same("population", evidence.population, Number(sqlRow.population));
  same("usable", evidence.usable, Number(sqlRow.usable));
  same("excluded", Object.fromEntries(Object.entries(evidence.excluded).sort()), Object.fromEntries(Object.entries(sqlRow.excluded || {}).sort()));
  const m = sqlRow.metrics || {};
  if ("escapes" in evidence.metrics) same("escapes", evidence.metrics.escapes, Number(m.escapes));
  if ("boat5_wins" in evidence.metrics) same("boat5_wins", evidence.metrics.boat5_wins, Number(m.boat5_wins));
  if ("high_count" in evidence.metrics) { same("high_count", evidence.metrics.high_count, Number(m.high_count)); same("median_payout", evidence.metrics.median_payout, Number(m.median_payout)); }
  if ("techniques" in evidence.metrics) same("techniques", Object.fromEntries(Object.entries(evidence.metrics.techniques).sort()), Object.fromEntries(Object.entries(m.techniques || {}).sort()));
  return diffs;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [exportFile, sqlFile, from, to, course, definitions] = process.argv.slice(2);
  const rows = decodeExport(JSON.parse(readFileSync(exportFile, "utf8")));
  const sql = Object.fromEntries(JSON.parse(readFileSync(sqlFile, "utf8")).map(r => [r.definition, r]));
  let failed = false;
  for (const definition of definitions.split(",")) {
    const params = course === "all" ? {} : { course_code: Number(course) };
    const evidence = computeDataset({ definition, rows, period: { from, to }, params, now: new Date() });
    const diffs = compare({ evidence, sqlRow: sql[definition] });
    console.log(JSON.stringify({ definition, status: evidence.status, issues: evidence.issues.map(i => i.code), population: evidence.population, usable: evidence.usable,
      coverage: evidence.coverage, excluded: evidence.excluded, metrics: evidence.metrics, hash: evidence.hash, match: diffs.length === 0, diffs }));
    if (diffs.length) failed = true;
  }
  process.exit(failed ? 1 : 0);
}
