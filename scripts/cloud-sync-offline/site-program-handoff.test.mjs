import assert from "node:assert/strict";
import test from "node:test";
import { selectSiteProgram } from "./site-program-handoff.mjs";

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
    { snapshot: { ...snapshot, program: { events: [event], entries: entries.slice(1) } } },
  ]) assert.equal(selectSiteProgram({ ...after, ...change }).status, "HOLD");
});
