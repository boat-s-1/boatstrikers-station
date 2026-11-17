import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { computeDataset } from "../../lib/blog/ai/data/datasets.mjs";
import { race, rowsOf, cleanRaces, FEMALE, MALE } from "./_raceRows.mjs";
const require = createRequire(new URL("../../scripts/blog/package.json", import.meta.url));
const { PGlite } = require("@electric-sql/pglite");

// PHASE 2: ops/blog/ai-real-data-verification.sql is an independent SQL implementation of the dataset rules. On the same
// rows (every defect the gate knows) it must give exactly what computeDataset() gives, so that on real data the two
// implementations check each other.
const SQL = readFileSync(new URL("../../ops/blog/ai-real-data-verification.sql", import.meta.url), "utf8");
const NOW = new Date("2026-11-03T12:00:00Z");
const PERIOD = { from: "2026-09-01", to: "2026-11-02" };
let db;

function corpus() {
  const races = [...cleanRaces({ n: 120, every5: 5, highEvery: 7 })];
  // Women's races on race number 13 of October days.
  cleanRaces({ n: 28, women: true, from: "2026-10-01", every5: 6, highEvery: 4 }).forEach((r, i) => {
    const date = `2026-10-${String(1 + i).padStart(2, "0")}`;
    for (const row of [r.result, r.event, ...r.entries]) { row.race_no = 13; row.race_date = date; }
    races.push(r);
  });
  let rno = 20;
  const odd = o => race({ date: "2026-10-15", rno: rno++, ...o });
  races.push(
    odd({ trifecta: "000", winning: null }), odd({ status: "scheduled" }), odd({ event: { race_cancel_code: "official_cancelled" } }),
    odd({ trifecta: "1-2-3", winning: "1-3-2" }), odd({ event: { trifecta: "2-1-3" } }), odd({ firstBoat: 2 }),
    odd({ entryOverrides: { 1: { arrival_order: 3 } } }), odd({ entryOverrides: { 1: { actual_course: null } } }), odd({ technique: "　　　　　" }),
    odd({ technique: "逃げ", courses: [2, 1, 3, 4, 5, 6] }), odd({ trifecta: "2-1-3", technique: "まくり", courses: [2, 1, 3, 4, 5, 6] }),
    odd({ payout: null }), odd({ event: { trifecta_payout: 9999 } }), odd({ racers: FEMALE.slice(0, 5).concat([9999]) }),
    odd({ racers: FEMALE, entryOverrides: { 3: { gender_code: "1" } } }), odd({ trifecta: "5-1-2", technique: "抜き", payout: 45000 }),
    odd({ trifecta: "163", winning: "1-6-3", payout: 3210 }), odd({ racers: MALE, trifecta: "2-1-3", technique: "差し", courses: [2, 1, 3, 4, 5, 6] }),
    odd({ racers: FEMALE, payout: null }), odd({ racers: FEMALE, technique: "　　　　　" }),
  );
  const short = odd({}); short.entries.pop(); races.push(short);
  races.push({ result: null, event: { race_date: "2026-10-16", course_code: 1, race_no: 1, race_status: "cancelled", race_cancel_code: "weather_postponed", trifecta: null, trifecta_payout: null }, entries: [] });
  races.push({ result: null, event: { race_date: "2026-10-16", course_code: 1, race_no: 2, race_status: "scheduled", race_cancel_code: null, trifecta: null, trifecta_payout: null }, entries: [] });
  // No result row, but a full field of entries (male): unknown for the women's dataset, never assumed to be mixed.
  const noResult = race({ date: "2026-10-16", rno: 3, racers: MALE }); noResult.result = null; races.push(noResult);
  races.push(...cleanRaces({ n: 12, cc: 2 }));
  return rowsOf(races);
}

before(async () => {
  db = new PGlite();
  await db.exec(`
    create table public.bs_race_results (race_date date, course_code smallint, race_no smallint, result_status text, trifecta_result text, winning_trifecta text,
      first_boat integer, trifecta_payout integer, winning_technique text, winning_method text);
    create table public.bs_race_events (race_date date, course_code smallint, race_no smallint, race_status text, race_cancel_code text, trifecta text, trifecta_payout integer);
    create table public.bs_race_entries (race_date date, course_code smallint, race_no smallint, boat_no smallint, racer_registration_no text, actual_course integer,
      arrival_order integer, gender_code text);
    create table public.racer_gender_master (racer_id integer, racer_gender text);`);
  const rows = corpus();
  const insert = async (table, cols, list) => {
    for (const r of list) await db.query(`insert into public.${table}(${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`, cols.map(c => r[c] ?? null));
  };
  await insert("bs_race_results", ["race_date", "course_code", "race_no", "result_status", "trifecta_result", "winning_trifecta", "first_boat", "trifecta_payout", "winning_technique", "winning_method"], rows.results);
  await insert("bs_race_events", ["race_date", "course_code", "race_no", "race_status", "race_cancel_code", "trifecta", "trifecta_payout"], rows.events);
  await insert("bs_race_entries", ["race_date", "course_code", "race_no", "boat_no", "racer_registration_no", "actual_course", "arrival_order", "gender_code"], rows.entries);
  await insert("racer_gender_master", ["racer_id", "racer_gender"], rows.genders);
});
after(async () => await db?.close());

async function runSql(period, courseCode) {
  const sql = SQL.replace(/select date '[\d-]+' as date_from, date '[\d-]+' as date_to, [^\n]+ as course_code/,
    `select date '${period.from}' as date_from, date '${period.to}' as date_to, ${courseCode === null ? "null" : courseCode}::smallint as course_code`);
  assert.notEqual(sql, SQL, "params replaced");
  return Object.fromEntries((await db.query(sql)).rows.map(r => [r.definition, r]));
}

const EXPORT = readFileSync(new URL("../../ops/blog/ai-real-data-export.sql", import.meta.url), "utf8");
async function runExport(period, courseCode, womenOnly) {
  const sql = EXPORT.replace(/select date '[\d-]+' as date_from, date '[\d-]+' as date_to, [^\n]+ as women_only/,
    `select date '${period.from}' as date_from, date '${period.to}' as date_to, ${courseCode === null ? "null" : courseCode}::smallint as course_code, ${womenOnly} as women_only`);
  assert.notEqual(sql, EXPORT, "params replaced");
  return (await db.query(sql)).rows[0].export;
}

test("the compact export decodes to rows that give exactly the same datasets as the original rows", async () => {
  const { decodeExport } = await import("../../scripts/blog/verify-real-data.mjs");
  const original = corpus();
  for (const [courseCode, womenOnly, definitions] of [[1, false, ["inside_escape", "boat5_win", "high_payout", "women_inside_escape"]], [null, true, ["women_inside_escape"]]]) {
    const decoded = decodeExport(await runExport(PERIOD, courseCode, womenOnly));
    for (const definition of definitions) {
      const params = courseCode === null ? {} : { course_code: courseCode };
      const a = computeDataset({ definition, rows: original, period: PERIOD, params, now: NOW });
      const b = computeDataset({ definition, rows: decoded, period: PERIOD, params, now: NOW });
      assert.deepEqual({ p: b.population, u: b.usable, x: b.excluded, m: b.metrics }, { p: a.population, u: a.usable, x: a.excluded, m: a.metrics }, `${definition} course=${courseCode} womenOnly=${womenOnly}`);
      assert.equal(b.hash, a.hash);
    }
  }
});

for (const [label, courseCode] of [["stadium 1", 1], ["all stadiums", null]]) {
  test(`SQL and computeDataset agree on every dataset (${label}), including every defect`, async () => {
    const sql = await runSql(PERIOD, courseCode);
    const rows = corpus();
    for (const definition of ["inside_escape", "women_inside_escape", "boat5_win", "high_payout"]) {
      const e = computeDataset({ definition, rows, period: PERIOD, params: courseCode === null ? {} : { course_code: courseCode }, now: NOW, thresholds: { minSample: 1, minCoverage: 0 } });
      const s = sql[definition];
      assert.equal(Number(s.population), e.population, `${definition} population`);
      assert.equal(Number(s.usable), e.usable, `${definition} usable`);
      assert.deepEqual(s.excluded ?? {}, e.excluded, `${definition} excluded`);
      const m = s.metrics;
      if (definition.includes("escape")) assert.equal(Number(m.escapes), e.metrics.escapes, `${definition} escapes`);
      if (definition === "women_inside_escape") assert.deepEqual(m.techniques, e.metrics.techniques);
      if (definition === "boat5_win") assert.equal(Number(m.boat5_wins), e.metrics.boat5_wins);
      if (definition === "high_payout") {
        assert.equal(Number(m.high_count), e.metrics.high_count);
        assert.equal(Number(m.boat5_in_high), e.metrics.boat5_in_high);
        assert.equal(Number(m.median_payout), e.metrics.median_payout);
      }
    }
  });
}
