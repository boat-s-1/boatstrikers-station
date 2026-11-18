import { inspectBatch } from "./batch-gate.mjs";

const key = row => `${row.race_date}/${row.course_code}/${row.race_no}/${row.boat_no}`;
const registration = value => /^0?\d{4}$/.test(String(value ?? "")) && Number(value) > 0
  ? String(Number(value)).padStart(4, "0") : null;
const normalize = entries => entries.map(row => ({
  ...row, racer_registration_no: registration(row?.racer_registration_no),
}));
const jstDate = milliseconds => new Date(milliseconds + 32400000).toISOString().slice(0, 10);
const hasTimezone = value => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value ?? "");

export function selectSiteProgram({ raceDate, now, snapshot, live }) {
  if (!snapshot) return { status: "NO_SNAPSHOT" };
  const currentTime = Date.parse(now);
  const capturedTime = Date.parse(snapshot.captured_at);
  if (!hasTimezone(now) || !hasTimezone(snapshot.captured_at) ||
      !Number.isFinite(currentTime) || !Number.isFinite(capturedTime) ||
      capturedTime > currentTime || snapshot.race_date !== raceDate ||
      jstDate(capturedTime + 86400000) !== raceDate ||
      ![jstDate(currentTime), jstDate(currentTime + 86400000)].includes(raceDate)) {
    return { status: "HOLD", reason: "invalid_snapshot_time" };
  }

  const staged = snapshot.program;
  if (!Array.isArray(staged?.entries) ||
      inspectBatch(staged.events, normalize(staged.entries), staged.events, raceDate).status !== "PASS_OFFLINE_ONLY") {
    return { status: "HOLD", reason: "invalid_snapshot_program" };
  }
  const snapshotProgram = { status: "READY", source: "previous_day_snapshot",
    events: staged.events, entries: staged.entries };
  if (jstDate(currentTime) !== raceDate) return snapshotProgram;

  if (!Array.isArray(live?.entries) ||
      inspectBatch(live.events, normalize(live.entries), staged.events, raceDate).status !== "PASS_OFFLINE_ONLY") {
    return { ...snapshotProgram, pendingLive: true };
  }
  const registrations = new Map(staged.entries.map(row => [key(row), registration(row.racer_registration_no)]));
  if (live.entries.some(row => registrations.get(key(row)) !== registration(row.racer_registration_no))) {
    return { status: "HOLD", reason: "live_registration_conflict" };
  }
  return { status: "READY", source: "live", events: live.events, entries: live.entries };
}
