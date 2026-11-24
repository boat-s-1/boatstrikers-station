import { inspectBatch } from "./batch-gate.mjs";

const raceKey = row => `${row.race_date}/${row.course_code}/${row.race_no}`;
const entryKey = row => `${raceKey(row)}/${row.boat_no}`;
const registration = value => /^0?\d{4}$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;
const jstDate = timestamp => new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function planPreviousDayProgramSave({ raceDate, capturedAt, now, batch, expectedRaces, expectedEntries, existingEvents, existingEntries, captureTiming = "previous_day" }) {
  const capturedMs = Date.parse(capturedAt);
  const nowMs = Date.parse(now);
  const explicitZone = value => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value ?? "");
  const sameDay = captureTiming === "race_day_morning";
  if (!explicitZone(capturedAt) || !explicitZone(now) || !Number.isFinite(capturedMs) ||
      !Number.isFinite(nowMs) || capturedMs > nowMs ||
      jstDate(capturedMs) !== jstDate(nowMs) ||
      (sameDay ? jstDate(nowMs) !== raceDate :
        captureTiming !== "previous_day" || jstDate(nowMs + 86400000) !== raceDate)) {
    return { status: "HOLD", reason: "not_previous_jst_day" };
  }
  if (sameDay) {
    const closings = Array.isArray(expectedRaces) && expectedRaces.map(row => {
      const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(row?.closing_time ?? "");
      if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return NaN;
      return Date.parse(`${raceDate}T${match[1].padStart(2, "0")}:${match[2]}:00+09:00`);
    });
    if (!closings?.length || closings.some(value => !Number.isFinite(value)) ||
        nowMs >= Math.min(...closings)) {
      return { status: "HOLD", reason: "morning_publication_deadline_missed" };
    }
  }
  if (batch?.status !== "PASS_OFFLINE_ONLY" || !Array.isArray(batch.entries) ||
      !Array.isArray(expectedRaces) || !Array.isArray(expectedEntries) ||
      !Array.isArray(existingEvents) || !Array.isArray(existingEntries)) {
    return { status: "HOLD", reason: "invalid_save_inputs" };
  }

  const entries = batch.entries.map(row => ({
    ...row, racer_registration_no: registration(row?.racer_registration_no),
  }));
  const officialEntries = expectedEntries.map(row => ({
    ...row, racer_registration_no: registration(row?.racer_registration_no),
  }));
  const officialRegistration = new Map(officialEntries.map(row =>
    [entryKey(row), row.racer_registration_no]));
  const uniqueRacersByRace = rows => {
    const racers = new Map();
    for (const row of rows) {
      const key = raceKey(row);
      if (!racers.has(key)) racers.set(key, new Set());
      const seen = racers.get(key);
      if (seen.has(row.racer_registration_no)) return false;
      seen.add(row.racer_registration_no);
    }
    return true;
  };
  if (inspectBatch(expectedRaces, officialEntries, expectedRaces, raceDate).status !== "PASS_OFFLINE_ONLY" ||
      inspectBatch(batch.events, entries, expectedRaces, raceDate).status !== "PASS_OFFLINE_ONLY" ||
      !uniqueRacersByRace(officialEntries) || !uniqueRacersByRace(entries) ||
      entries.some(row => officialRegistration.get(entryKey(row)) !== row.racer_registration_no)) {
    return { status: "HOLD", reason: "invalid_candidate_batch" };
  }
  if (sameDay && batch.events.some(row =>
    row.closing_time && expectedRaces.find(expected => raceKey(expected) === raceKey(row))?.closing_time !== row.closing_time)) {
    return { status: "HOLD", reason: "official_closing_mismatch" };
  }

  // The DB snapshot must already be scoped to the requested JST race date.
  const eventsByKey = new Map(batch.events.map(row => [raceKey(row), row]));
  const entriesByKey = new Map(entries.map(row => [entryKey(row), row]));
  const seenEvents = new Set();
  const seenEntries = new Set();
  for (const row of existingEvents) {
    const key = raceKey(row);
    if (!eventsByKey.has(key) || seenEvents.has(key)) {
      return { status: "HOLD", reason: "unexpected_existing_event", key };
    }
    seenEvents.add(key);
  }
  for (const row of existingEntries) {
    const key = entryKey(row);
    if (!seenEvents.has(raceKey(row)) || seenEntries.has(key) ||
        entriesByKey.get(key)?.racer_registration_no !== registration(row.racer_registration_no)) {
      return { status: "HOLD", reason: "existing_entry_conflict", key };
    }
    seenEntries.add(key);
  }

  return {
    status: "PASS_OFFLINE_ONLY",
    missingEvents: batch.events.filter(row => !seenEvents.has(raceKey(row))),
    missingEntries: batch.entries.filter(row => !seenEntries.has(entryKey(row))),
  };
}

// Offline-only. The current SQL writer and snapshot reader remain previous-day-only.
export function planRaceDayMorningProgramSave(input) {
  return planPreviousDayProgramSave({ ...input, captureTiming: "race_day_morning" });
}
