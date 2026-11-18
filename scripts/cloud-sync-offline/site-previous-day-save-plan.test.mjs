import assert from "node:assert/strict";
import test from "node:test";
import { planPreviousDayProgramSave } from "./site-previous-day-save-plan.mjs";

const event = { race_date: "2026-11-19", course_code: 1, race_no: 1 };
const entries = Array.from({ length: 6 }, (_, i) => ({
  ...event, boat_no: i + 1, racer_registration_no: String(4000 + i).padStart(5, "0"),
}));
const options = {
  raceDate: event.race_date,
  capturedAt: "2026-11-18T14:50:00Z",
  now: "2026-11-18T23:59:00+09:00",
  batch: { status: "PASS_OFFLINE_ONLY", events: [event], entries },
  existingEvents: [],
  existingEntries: [],
};

test("plans all missing or only missing entries and leaves replays empty", () => {
  const full = planPreviousDayProgramSave(options);
  assert.equal(full.status, "PASS_OFFLINE_ONLY");
  assert.equal(full.missingEvents.length, 1);
  assert.equal(full.missingEntries.length, 6);
  const prefix = [{ ...entries[0], racer_registration_no: "4000" }];
  const partial = planPreviousDayProgramSave({ ...options, existingEvents: [event], existingEntries: prefix });
  assert.deepEqual(partial.missingEvents, []);
  assert.deepEqual(partial.missingEntries, entries.slice(1));
  const replay = planPreviousDayProgramSave({ ...options, existingEvents: [event], existingEntries: entries });
  assert.deepEqual(replay, { status: "PASS_OFFLINE_ONLY", missingEvents: [], missingEntries: [] });
});

test("rejects a conflicting existing registration without exposing save rows", () => {
  const plan = planPreviousDayProgramSave({
    ...options, existingEvents: [event], existingEntries: [{ ...entries[0], racer_registration_no: "4999" }],
  });
  assert.equal(plan.reason, "existing_entry_conflict");
  assert.equal("missingEntries" in plan, false);
});

test("fails closed at JST midnight, on future capture, or when a date lacks a timezone", () => {
  for (const change of [
    { now: "2026-11-18T15:00:00Z" },
    { capturedAt: "2026-11-18T14:59:01Z" },
    { capturedAt: "2026-11-18T23:50:00" },
  ]) {
    assert.equal(planPreviousDayProgramSave({ ...options, ...change }).reason, "not_previous_jst_day");
  }
});
