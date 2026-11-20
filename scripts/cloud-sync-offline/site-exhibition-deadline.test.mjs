import assert from "node:assert/strict";
import test from "node:test";
import { assessExhibitionDeadline, assessExhibitionSiteDeadline } from "./site-exhibition-deadline.mjs";

const event = { race_date: "2026-11-19", course_code: 1, race_no: 1, closing_time: "15:00:00" };
const entries = Array.from({ length: 6 }, (_, i) => ({
  race_date: event.race_date, course_code: 1, race_no: 1, boat_no: i + 1,
  exhibition_time: 6.8,
  racer_registration_no: String(4000 + i),
  exhibition_synced_at: "2026-11-19T14:49:59+09:00",
}));
const check = (changes = {}) => assessExhibitionDeadline({ event, entries, now: "2026-11-19T14:55:00+09:00", ...changes });

test("all six exhibition rows must arrive by closing minus ten minutes", () => {
  assert.deepEqual(check(), { status: "ON_TIME", cutoffAt: "2026-11-19T05:50:00.000Z",
    completedAt: "2026-11-19T05:49:59.000Z" });
  assert.equal(check({ entries: entries.map((row, i) => i === 5
    ? { ...row, exhibition_synced_at: "2026-11-19T14:50:01+09:00" } : row) }).status, "LATE");
  assert.equal(check({ entries: entries.map((row, i) => i === 5
    ? { ...row, exhibition_synced_at: "2026-11-19T14:50:00+09:00" } : row) }).status, "ON_TIME");
});

test("missing boat is pending until cutoff and missed afterward", () => {
  const incomplete = entries.map((row, i) => i === 5 ? { ...row, exhibition_synced_at: null } : row);
  assert.equal(check({ entries: incomplete, now: "2026-11-19T14:50:00+09:00" }).status, "PENDING");
  assert.equal(check({ entries: incomplete }).status, "MISSED");
});

test("a sync timestamp without an exhibition value cannot satisfy the deadline", () => {
  const noValue = entries.map((row, i) => i === 5 ? { ...row, exhibition_time: null } : row);
  assert.equal(check({ entries: noValue, now: "2026-11-19T14:50:00+09:00" }).status, "PENDING");
  assert.equal(check({ entries: noValue }).status, "MISSED");
  assert.equal(check({ entries: entries.map((row, i) => i === 5
    ? { ...row, exhibition_time: 0 } : row) }).status, "INVALID");
});

test("rejects duplicate or unrelated boats, future and timezone-free timestamps", () => {
  for (const changes of [
    { entries: [...entries.slice(0, 5), entries[0]] },
    { entries: entries.slice(0, 5) },
    { entries: entries.map((row, i) => i === 5 ? { ...row, race_no: 2 } : row) },
    { entries: entries.map((row, i) => i === 5
      ? { ...row, exhibition_synced_at: "2026-11-19T15:01:00+09:00" } : row) },
    { now: "2026-11-19T14:55:00" },
    { event: { ...event, closing_time: "25:00" } },
  ]) assert.equal(check(changes).status, "INVALID");
});

test("storage alone does not prove site visibility before the deadline", () => {
  const base = { event, entries, now: "2026-11-19T14:55:00+09:00" };
  assert.equal(assessExhibitionSiteDeadline(base).status, "SITE_UNVERIFIED");
  const visibleEntries = entries.map(({ boat_no, exhibition_time, racer_registration_no }) =>
    ({ boat_no, exhibition_time, racer_registration_no }));
  assert.equal(assessExhibitionSiteDeadline({ ...base, visibleEntries,
    siteVisibleAt: "2026-11-19T14:50:00+09:00" }).status, "SITE_ON_TIME");
  assert.equal(assessExhibitionSiteDeadline({ ...base, visibleEntries,
    siteVisibleAt: "2026-11-19T14:50:01+09:00" }).status, "SITE_LATE");
  for (const change of [
    { visibleEntries: [...visibleEntries.slice(0, 5), visibleEntries[0]], siteVisibleAt: "2026-11-19T14:50:00+09:00" },
    { visibleEntries: visibleEntries.map((row, index) => index === 5
      ? { ...row, exhibition_time: 6.9 } : row), siteVisibleAt: "2026-11-19T14:50:00+09:00" },
    { visibleEntries: visibleEntries.map((row, index) => index === 5
      ? { ...row, racer_registration_no: visibleEntries[0].racer_registration_no } : row), siteVisibleAt: "2026-11-19T14:50:00+09:00" },
    { visibleEntries: visibleEntries.map((row, index) => index === 5
      ? { ...row, racer_registration_no: null } : row), siteVisibleAt: "2026-11-19T14:50:00+09:00" },
    { visibleEntries, siteVisibleAt: "2026-11-19T14:49:58+09:00" },
  ]) assert.equal(assessExhibitionSiteDeadline({ ...base, ...change }).status, "INVALID");
});
