import assert from "node:assert/strict";
import test from "node:test";
import { selectSiteProgram, selectSiteRaceProgram } from "./site-program-handoff.mjs";

import { readSiteProgramCandidate } from "./site-program-server-read.mjs";
const raceDate = "2026-11-19";
const event = { race_date: raceDate, course_code: 1, race_no: 1 };
const entries = Array.from({ length: 6 }, (_, i) => ({
  ...event, boat_no: i + 1, racer_registration_no: String(4000 + i).padStart(5, "0"),
}));
const snapshot = { race_date: raceDate, captured_at: "2026-11-18T23:55:00+09:00",
  program: { events: [event], entries } };
const live = { events: [{ ...event, closing_time: "15:10" }],
  entries: entries.map(row => ({ ...row, racer_registration_no: row.racer_registration_no.slice(1), exhibition_time: 6.8 })) };
const before = { raceDate, snapshot, now: "2026-11-18T14:59:59Z", live };
const after = { ...before, now: "2026-11-18T15:00:00Z" };

test("uses the complete snapshot before midnight and hands off to complete live rows", () => {
  assert.equal(selectSiteProgram(before).source, "previous_day_snapshot");
  const result = selectSiteProgram(after);
  assert.equal(result.source, "live");
  assert.equal(result.entries[0].exhibition_time, 6.8);
  assert.equal(result.events[0].closing_time, "15:10");
});

test("retains the whole snapshot if live rows are missing or incomplete", () => {
  for (const missing of [undefined, { ...live, entries: live.entries.slice(1) }]) {
    const result = selectSiteProgram({ ...after, live: missing });
    assert.equal(result.pendingLive, true);
    assert.deepEqual(result.entries, entries);
    assert.equal("exhibition_time" in result.entries[0], false);
  }
});

test("holds a complete conflicting roster for official confirmation", () => {
  const changed = [{ ...live.entries[0], racer_registration_no: "4999" }, ...live.entries.slice(1)];
  assert.deepEqual(selectSiteProgram({ ...after, live: { ...live, entries: changed } }),
    { status: "HOLD", reason: "live_registration_conflict" });
});

test("rejects stale, mislabeled and incomplete snapshots", () => {
  assert.deepEqual(selectSiteProgram({ ...after, snapshot: undefined }), { status: "NO_SNAPSHOT" });
  for (const change of [
    { now: "2026-11-20T00:00:00+09:00" },
    { snapshot: { ...snapshot, captured_at: "2026-11-19T00:00:00+09:00" } },
    { snapshot: { ...snapshot, captured_at: "invalid" } },
    { snapshot: { ...snapshot, program: { events: [event], entries: entries.slice(1) } } },
  ]) assert.equal(selectSiteProgram({ ...after, ...change }).status, "HOLD");
});

test("race-day morning snapshot is displayable only for the same day and before the first closing", () => {
  const staged = { ...snapshot, capture_timing: "race_day_morning",
    captured_at: "2026-11-18T23:30:00Z", program: {
      events: [{ ...event, closing_time: "08:35" }], entries,
    } };
  const options = { ...after, now: "2026-11-19T08:31:00+09:00", snapshot: staged, live: undefined };
  assert.equal(selectSiteProgram(options).source, "race_day_morning_snapshot");
  assert.equal(selectSiteRaceProgram(options, { courseCode: 1, raceNo: 1 }).source,
    "race_day_morning_snapshot");
  for (const change of [
    { now: "2026-11-18T23:40:00+09:00" },
    { now: "2026-11-20T00:00:00+09:00" },
    { snapshot: { ...staged, captured_at: "2026-11-18T23:36:00Z" } },
    { snapshot: { ...staged, capture_timing: "unknown" } },
    { snapshot: { ...staged, program: { events: [event], entries } } },
  ]) assert.equal(selectSiteProgram({ ...options, ...change }).status, "HOLD");
});

test("one fully matched race can display live even if another race is incomplete", () => {
  const otherEvent = { ...event, race_no: 2 };
  const otherBoats = entries.map(row => ({ ...row, race_no: 2 }));
  const twoRaces = {
    ...after,
    snapshot: { ...snapshot, program: {
      events: [event, otherEvent], entries: [...entries, ...otherBoats],
    } },
    live: { events: [...live.events, otherEvent], entries: [...live.entries, ...otherBoats.slice(0, 5)] },
  };
  assert.equal(selectSiteProgram(twoRaces).pendingLive, true);
  const ready = selectSiteRaceProgram(twoRaces, { courseCode: 1, raceNo: 1 });
  assert.equal(ready.source, "live");
  assert.equal(ready.entries.length, 6);
  assert.equal(ready.entries[0].exhibition_time, 6.8);
  assert.equal(selectSiteRaceProgram(twoRaces, { courseCode: 1, raceNo: 2 }).source, "previous_day_snapshot");
  assert.deepEqual(selectSiteRaceProgram(twoRaces, { courseCode: 1, raceNo: 3 }), { status: "NO_RACE" });
});

test("a race with inconsistent live identities or duplicate keys stays isolated", () => {
  const key = { courseCode: 1, raceNo: 1 };
  const conflict = [{ ...live.entries[0], racer_registration_no: "4999" }, ...live.entries.slice(1)];
  assert.deepEqual(selectSiteRaceProgram({ ...after, live: { ...live, entries: conflict } }, key),
    { status: "HOLD", reason: "live_registration_conflict" });
  assert.equal(selectSiteRaceProgram({ ...after, live: { ...live, events: [event, event] } }, key).pendingLive, true);
  assert.equal(selectSiteRaceProgram(before, key).source, "previous_day_snapshot");
});

test("server reader passes only the requested date and selects the matched race", async () => {
  const client = { async rpc(name, parameters) {
    assert.equal(name, "bs_read_site_previous_day_program_candidate");
    assert.deepEqual(parameters, { p_date: raceDate });
    return { data: snapshot, error: null };
  } };
  const read = await readSiteProgramCandidate(client, { ...after, race: { courseCode: 1, raceNo: 1 } });
  assert.equal(read.source, "live");
  assert.equal(read.entries.length, 6);
});

test("server reader distinguishes absence from failed DB queries", async () => {
  const noSnapshot = await readSiteProgramCandidate({ rpc: async () => ({ data: null }) }, after);
  assert.deepEqual(noSnapshot, { status: "NO_SNAPSHOT" });
  for (const rpc of [async () => ({ error: {} }), async () => { throw new Error(); }]) {
    assert.deepEqual(await readSiteProgramCandidate({ rpc }, after),
      { status: "HOLD", reason: "snapshot_read_failed" });
  }
});
