import { inspectBatch } from "./batch-gate.mjs";
import { parseSiteOfficialRacelist } from "./site-official-racelist.mjs";

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

  const registrations = new Map(staged.entries.map(row => [key(row), registration(row.racer_registration_no)]));
  if (Array.isArray(live?.entries) && live.entries.some(row => {
    const expected = row && registrations.get(key(row));
    const actual = row && registration(row.racer_registration_no);
    return expected && actual && expected !== actual;
  })) {
    return { status: "HOLD", reason: "live_registration_conflict" };
  }
  if (!Array.isArray(live?.entries) ||
      inspectBatch(live.events, normalize(live.entries), staged.events, raceDate).status !== "PASS_OFFLINE_ONLY") {
    return { ...snapshotProgram, pendingLive: true };
  }
  return { status: "READY", source: "live", events: live.events, entries: live.entries };
}

// The day view stays complete while an independently matched race can use live fields.
export function selectSiteRaceProgram(options, { courseCode, raceNo }, officialCorrection) {
  const fullDay = selectSiteProgram({ ...options, live: undefined });
  if (fullDay.status !== "READY") return fullDay;
  const matches = row => row?.race_date === options.raceDate &&
    row.course_code === courseCode && row.race_no === raceNo;
  const stagedRace = {
    events: fullDay.events.filter(matches),
    entries: fullDay.entries.filter(matches),
  };
  if (stagedRace.events.length !== 1) return { status: "NO_RACE" };

  const { live, snapshot } = options;
  const liveRace = Array.isArray(live?.events) && Array.isArray(live?.entries)
    ? { events: live.events.filter(matches), entries: live.entries.filter(matches) }
    : undefined;
  const input = { ...options, snapshot: { ...snapshot, program: stagedRace }, live: liveRace };
  const selection = selectSiteProgram(input);
  if (selection.reason !== "live_registration_conflict" || !officialCorrection) return selection;

  // Only server-verified official HTML may be supplied by a future correction collector.
  const capturedAt = Date.parse(officialCorrection.capturedAt);
  if (!hasTimezone(officialCorrection.capturedAt) || !Number.isFinite(capturedAt) ||
      capturedAt > Date.parse(options.now) || jstDate(capturedAt) !== options.raceDate) return selection;

  let corrected;
  try {
    corrected = parseSiteOfficialRacelist(officialCorrection.html, {
      raceDate: options.raceDate, courseCode, raceNo,
    });
  } catch {
    return selection;
  }
  const event = { ...stagedRace.events[0], closing_time: corrected.closing_time };
  const correctedEntries = corrected.entries.map(entry => ({ ...event, ...entry }));
  const verifiedLive = selectSiteProgram({
    ...input,
    snapshot: { ...snapshot, program: { events: [event], entries: correctedEntries } },
  });
  if (verifiedLive.source !== "live") return selection;
  return { ...verifiedLive, correctionVerified: true };
}
