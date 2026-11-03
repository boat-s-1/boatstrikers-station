import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTrifecta, normalizeTechnique, normalizeRegistrationNo, assessRace, genderMap, usableFor } from "../../lib/blog/ai/data/raceQuality.mjs";
import { computeDataset, datasetSource, recheckDataset, researchPeriod, evidenceHash, DATASETS } from "../../lib/blog/ai/data/datasets.mjs";
import { readRaceRows, readOnly, MAX_ROWS } from "../../lib/blog/ai/data/reader.mjs";
import { researchPlan, computeResearchDataset, buildResearchPack } from "../../lib/blog/ai/data/researchPack.mjs";
import { race, rowsOf, cleanRaces, genderRows, FEMALE, MALE } from "./_raceRows.mjs";

const NOW = new Date("2026-11-03T12:00:00Z"); // 21:00 JST
const PERIOD = { from: "2026-09-01", to: "2026-11-02" };
const genders = genderMap(genderRows());
const assess = r => assessRace({ result: r.result, event: r.event, entries: r.entries, genders });

test("normalisation: trifecta formats, padded techniques and zero-padded registration numbers", () => {
  assert.equal(normalizeTrifecta("1-2-3"), "1-2-3");
  assert.equal(normalizeTrifecta("163"), "1-6-3");
  for (const bad of ["000", "1-1-2", "7-1-2", "12", "", null, "1=2-3"]) assert.equal(normalizeTrifecta(bad), null, String(bad));
  assert.equal(normalizeTechnique("逃げ　　　"), "逃げ");
  assert.equal(normalizeTechnique("まくり差し"), "まくり差し");
  assert.equal(normalizeTechnique("　　　　　"), null);
  assert.equal(normalizeTechnique("ジャンプ"), null);
  assert.equal(normalizeRegistrationNo("04794"), "4794");
  assert.equal(normalizeRegistrationNo(4794), "4794");
  assert.equal(normalizeRegistrationNo(" 4794 "), "4794");
  assert.equal(normalizeRegistrationNo("A123"), null);
  assert.equal(normalizeRegistrationNo("0000"), null);
});

test("a clean race passes every field group and reads winner, course, technique, payout and gender", () => {
  const a = assess(race({ trifecta: "123", technique: "逃げ　　　", payout: 1230 }));
  assert.deepEqual(a.problems, { result: [], course: [], payout: [], gender: [] });
  assert.equal(a.fields.first_boat, 1);
  assert.equal(a.fields.winner_course, 1);
  assert.equal(a.fields.technique, "逃げ");
  assert.equal(a.fields.payout, 1230);
  assert.equal(a.fields.all_female, false);
  assert.equal(assess(race({ racers: FEMALE })).fields.all_female, true);
});

test("each defect is excluded with its reason and nothing is filled in", () => {
  const cases = [
    [race({ trifecta: "000", winning: null }), "result", "invalid_trifecta"],
    [race({ status: "scheduled" }), "result", "result_unconfirmed"],
    [race({ event: { race_cancel_code: "official_cancelled" } }), "result", "cancelled"],
    [race({ trifecta: "1-2-3", winning: "1-3-2" }), "result", "trifecta_conflict"],
    [race({ event: { trifecta: "2-1-3" } }), "result", "trifecta_conflict"],
    [race({ firstBoat: 2 }), "result", "first_boat_conflict"],
    [race({ entryOverrides: { 1: { arrival_order: 3 } } }), "result", "arrival_conflict"],
    [race({ entryOverrides: { 1: { actual_course: null } } }), "course", "course_missing"],
    [race({ entryOverrides: { 2: { actual_course: 1 } } }), "course", "course_missing"],
    [race({ technique: "　　　　　" }), "course", "technique_missing"],
    [race({ technique: "逃げ", courses: [2, 1, 3, 4, 5, 6] }), "course", "technique_course_conflict"],
    [race({ trifecta: "2-1-3", technique: "まくり", courses: [2, 1, 3, 4, 5, 6] }), "course", "technique_course_conflict"],
    [race({ payout: null }), "payout", "payout_missing"],
    [race({ payout: 0 }), "payout", "payout_missing"],
    [race({ event: { trifecta_payout: 9999 } }), "payout", "payout_conflict"],
    [race({ racers: [3001, 3002, 3003, 3004, 3005, 9999] }), "gender", "gender_unknown"],
    [race({ racers: FEMALE, entryOverrides: { 3: { gender_code: "1" } } }), "gender", "gender_conflict"],
  ];
  for (const [r, group, code] of cases) {
    const a = assess(r);
    assert.ok(a.problems[group].includes(code), `${code}: ${JSON.stringify(a.problems)}`);
    assert.equal(usableFor(a, [group]), false, code);
  }
  const missing = race(); missing.entries.pop();
  const a = assess(missing);
  assert.ok(a.problems.course.includes("entries_incomplete") && a.problems.gender.includes("entries_incomplete"));
  assert.equal(a.fields.winner_course, null);
  assert.equal(a.fields.all_female, null, "an incomplete field is unknown, never assumed");
  // 抜き and 恵まれ can come from any course, including the first.
  assert.deepEqual(assess(race({ technique: "抜き" })).problems.course, []);
  assert.deepEqual(assess(race({ trifecta: "3-1-2", technique: "恵まれ" })).problems.course, []);
  // No result row at all.
  assert.deepEqual(assessRace({ result: null, event: race().event }).problems.result, ["result_missing"]);
});

test("a payout problem does not stop course-based counting, and a course problem does not stop boat-5 counting", () => {
  const noPayout = assess(race({ payout: null }));
  assert.equal(usableFor(noPayout, DATASETS.inside_escape.needs), true);
  assert.equal(usableFor(noPayout, DATASETS.high_payout.needs), false);
  const noCourse = assess(race({ entryOverrides: { 4: { actual_course: null } } }));
  assert.equal(usableFor(noCourse, DATASETS.boat5_win.needs), true);
  assert.equal(usableFor(noCourse, DATASETS.inside_escape.needs), false);
});

test("inside-escape dataset: counts, exclusions by reason, coverage and an ok status", () => {
  const races = [...cleanRaces({ n: 200, every5: 4 }), race({ date: "2026-09-30", rno: 13, trifecta: "000", winning: null })];
  const e = computeDataset({ definition: "inside_escape", rows: rowsOf(races), period: PERIOD, params: { scope_name: "桐生", course_code: 1 }, now: NOW });
  assert.equal(e.status, "ok", JSON.stringify(e.issues));
  assert.equal(e.population, 201);
  assert.equal(e.usable, 200);
  assert.deepEqual(e.excluded, { invalid_trifecta: 1 });
  assert.equal(e.metrics.escapes, 150);
  assert.equal(e.metrics.escape_rate, 75);
  assert.equal(e.coverage, 0.995);
  assert.match(e.hash, /^[0-9a-f]{64}$/);
  assert.equal(e.hash, evidenceHash(e));
});

test("the gate holds a dataset with too few races, too much bad data, an unfinished day or no races", () => {
  const few = computeDataset({ definition: "inside_escape", rows: rowsOf(cleanRaces({ n: 50 })), period: PERIOD, now: NOW });
  assert.equal(few.status, "hold");
  assert.deepEqual(few.issues.map(i => i.code), ["insufficient_sample"]);

  const bad = cleanRaces({ n: 120 }).concat(Array.from({ length: 20 }, (_, i) => race({ date: "2026-10-20", cc: 1, rno: i + 1, payout: 1000, technique: "　　　　　" })));
  const low = computeDataset({ definition: "inside_escape", rows: rowsOf(bad), period: PERIOD, now: NOW });
  assert.equal(low.status, "hold");
  assert.ok(low.issues.some(i => i.code === "low_coverage"));
  assert.equal(low.excluded.technique_missing, 20);

  const today = computeDataset({ definition: "inside_escape", rows: rowsOf(cleanRaces({ n: 200 })), period: { from: "2026-09-01", to: "2026-11-03" }, now: NOW });
  assert.ok(today.issues.some(i => i.code === "period_not_finished"));

  const none = computeDataset({ definition: "boat5_win", rows: rowsOf([]), period: PERIOD, now: NOW });
  assert.deepEqual(none.issues.map(i => i.code), ["no_races"]);
  assert.throws(() => datasetSource(none), /品質基準/);
});

test("cancelled races with no result are not part of the population; outside the period or stadium are ignored", () => {
  const cancelled = { result: null, event: { race_date: "2026-10-01", course_code: 1, race_no: 12, race_status: "cancelled", race_cancel_code: "weather_postponed" }, entries: [] };
  const elsewhere = cleanRaces({ n: 30, cc: 2 }).concat(cleanRaces({ n: 30, from: "2026-08-01" }));
  const e = computeDataset({ definition: "boat5_win", rows: rowsOf([...cleanRaces({ n: 120, every5: 3 }), cancelled, ...elsewhere]), period: PERIOD, params: { course_code: 1 }, now: NOW });
  assert.equal(e.population, 120);
  assert.equal(e.metrics.boat5_wins, 40);
  assert.equal(e.metrics.boat5_win_rate, 33.3);
  // An event with no result and no cancellation is a missing result, never skipped silently.
  const lost = { result: null, event: { race_date: "2026-10-02", course_code: 1, race_no: 12, race_status: "scheduled", race_cancel_code: null }, entries: [] };
  const e2 = computeDataset({ definition: "boat5_win", rows: rowsOf([...cleanRaces({ n: 120 }), lost]), period: PERIOD, params: { course_code: 1 }, now: NOW });
  assert.deepEqual(e2.excluded, { result_missing: 1 });
});

test("women's races are races with six female entrants in the master; unknown entrants count against coverage", () => {
  const women = cleanRaces({ n: 110, women: true });
  const mixed = cleanRaces({ n: 60, from: "2026-10-10" });
  const unknown = [race({ date: "2026-10-30", rno: 1, racers: [3001, 3002, 3003, 3004, 3005, 8888] })];
  const e = computeDataset({ definition: "women_inside_escape", rows: rowsOf([...women, ...mixed, ...unknown]), period: PERIOD, now: NOW });
  assert.equal(e.population, 111, "mixed races are not candidates; the race with an unknown entrant is");
  assert.equal(e.usable, 110);
  assert.deepEqual(e.excluded, { gender_unknown: 1 });
  assert.equal(e.metrics.escape_rate, 100);
  assert.deepEqual(e.metrics.techniques, { 逃げ: 110 });
  assert.equal(e.status, "ok");
  // The gender code on the entry and the master disagree: excluded, not decided either way.
  const conflict = race({ date: "2026-10-31", racers: FEMALE, entryOverrides: { 1: { gender_code: "1" } } });
  const e2 = computeDataset({ definition: "women_inside_escape", rows: rowsOf([...women, conflict]), period: PERIOD, now: NOW });
  assert.deepEqual(e2.excluded, { gender_conflict: 1 });
  // Registration numbers stored as "03001" and "3002" both resolve (see _raceRows.mjs).
  assert.equal(computeDataset({ definition: "women_inside_escape", rows: rowsOf(women), period: PERIOD, now: NOW }).usable, 110);
});

test("high-payout dataset uses confirmed payouts only, with the 10,000 yen threshold", () => {
  const races = cleanRaces({ n: 150, highEvery: 10, every5: 10 });
  races.push(race({ date: "2026-10-31", rno: 1, payout: null }));
  const e = computeDataset({ definition: "high_payout", rows: rowsOf(races), period: PERIOD, now: NOW });
  assert.equal(e.metrics.threshold, 10000);
  assert.equal(e.metrics.high_count, 15);
  assert.equal(e.metrics.high_rate, 10);
  assert.equal(e.metrics.boat5_in_high, 15);
  assert.equal(e.metrics.median_payout, 1500);
  assert.deepEqual(e.excluded, { payout_missing: 1 });
});

test("dataset → source pack facts carry period and hash; recheck detects changed or tampered data", () => {
  const rows = rowsOf(cleanRaces({ n: 150, every5: 5 }));
  const e = computeDataset({ definition: "boat5_win", rows, period: PERIOD, params: { scope_name: "桐生", course_code: 1 }, now: NOW });
  const { source, facts } = datasetSource(e);
  assert.equal(source.kind, "boatstrikers_dataset");
  assert.equal(source.period, "2026/09/01〜2026/11/02");
  assert.equal(source.dataset_hash, e.hash);
  assert.ok(facts.some(f => f.label === "桐生の5号艇1着率" && f.value === "20" && f.unit === "%"));
  assert.ok(facts.every(f => f.period === source.period && f.source_id === source.id));
  const again = computeDataset({ definition: "boat5_win", rows, period: PERIOD, params: { scope_name: "桐生", course_code: 1 }, now: new Date("2026-11-04T00:00:00Z") });
  assert.deepEqual(recheckDataset({ stored: e, recomputed: again }), { ok: true }, "computed_at is not part of the hash");
  const changed = computeDataset({ definition: "boat5_win", rows: rowsOf(cleanRaces({ n: 151, every5: 5 })), period: PERIOD, params: { scope_name: "桐生", course_code: 1 }, now: NOW });
  assert.equal(recheckDataset({ stored: e, recomputed: changed }).code, "dataset_changed");
  assert.equal(recheckDataset({ stored: { ...e, metrics: { ...e.metrics, boat5_wins: 99 } }, recomputed: e }).code, "dataset_tampered");
  assert.equal(recheckDataset({ stored: e, recomputed: null }).code, "dataset_missing");
});

test("research period ends on the previous JST day", () => {
  assert.deepEqual(researchPeriod({ now: new Date("2026-11-03T14:59:00Z"), days: 365 }), { from: "2025-11-03", to: "2026-11-02", days: 365 });
  assert.deepEqual(researchPeriod({ now: new Date("2026-11-03T15:00:00Z"), days: 90 }), { from: "2026-08-06", to: "2026-11-03", days: 90 });
  assert.throws(() => researchPeriod({ days: 3 }), /7〜731/);
});

function fakeClient(tables, calls) {
  return {
    from(table) {
      const state = { table, filters: [] };
      const q = {
        select(columns) { state.columns = columns; return q; },
        gte(c, v) { state.filters.push(["gte", c, v]); return q; }, lte(c, v) { state.filters.push(["lte", c, v]); return q; },
        eq(c, v) { state.filters.push(["eq", c, v]); return q; }, order() { return q; },
        range(a, b) { calls.push({ ...state, a, b }); return Promise.resolve({ data: (tables[table] || []).slice(a, b + 1), error: null }); },
        insert() { throw new Error("write attempted"); }, update() { throw new Error("write attempted"); }, delete() { throw new Error("write attempted"); },
      };
      return q;
    },
    rpc() { throw new Error("rpc attempted"); },
  };
}

test("the reader only selects listed columns, pages through results and refuses oversize reads", async () => {
  const calls = [];
  const rows = rowsOf(cleanRaces({ n: 30 }));
  const client = fakeClient({ bs_race_results: rows.results, bs_race_events: rows.events, bs_race_entries: rows.entries, racer_gender_master: rows.genders }, calls);
  const read = await readRaceRows(client, { period: PERIOD, courseCode: 1 });
  assert.equal(read.entries.length, 180);
  assert.ok(calls.every(c => !/\*/.test(c.columns)));
  assert.ok(calls.filter(c => c.table !== "racer_gender_master").every(c => c.filters.some(f => f[0] === "eq" && f[1] === "course_code")));
  const ro = readOnly(client).from("bs_race_results");
  assert.deepEqual(Object.keys(ro), ["select"]);
  const big = { bs_race_entries: Array.from({ length: MAX_ROWS + 2000 }, () => ({})) };
  await assert.rejects(readRaceRows(fakeClient(big, []), { period: PERIOD }), /多すぎます/);
  const failing = { from: () => ({ select: () => ({ gte: () => ({ lte: () => ({ order: () => ({ order: () => ({ order: () => ({ order: () => ({ range: async () => ({ data: null, error: { message: "boom" } }) }), range: async () => ({ data: null, error: { message: "boom" } }) }) }) }) }) }), order: () => ({ range: async () => ({ data: null, error: { message: "boom" } }) }) }) }) };
  await assert.rejects(readRaceRows(failing, { period: PERIOD }), e => e.status === 502 && !/boom/.test(e.message), "database details are not exposed");
});

test("research topics map to the dataset and stadium; the pack holds only dataset facts", async () => {
  const topic = { id: "t1", topic_key: "longshot:kiryu:boat5-365", category_slug: "longshot", stadium_slug: "kiryu", angle: "boat5-365", title_hint: "桐生の5号艇", character_key: "kiina" };
  const plan = researchPlan(topic, { now: NOW });
  assert.equal(plan.definition, "boat5_win");
  assert.deepEqual(plan.params, { scope_name: "桐生", course_code: 1 });
  assert.equal(plan.period.to, "2026-11-02");
  assert.equal(researchPlan({ ...topic, category_slug: "stadium-basics", angle: "water" }), null);
  let asked;
  const evidence = await computeResearchDataset({ topic, now: NOW, readRows: async args => { asked = args; return rowsOf(cleanRaces({ n: 150, every5: 5, from: "2026-06-01" })); } });
  assert.equal(asked.courseCode, 1);
  assert.equal(evidence.status, "ok");
  const pack = buildResearchPack({ topic, evidence, now: NOW });
  assert.equal(pack.sources.length, 1);
  assert.equal(pack.documents.length, 0);
  assert.ok(pack.facts.every(f => f.source_id === "D1"));
  assert.equal(pack.datasets[0].hash, evidence.hash);
});
