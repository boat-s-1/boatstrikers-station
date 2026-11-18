import { inspectBatch } from "./batch-gate.mjs";

const raceKey = row => `${row.race_date}/${row.course_code}/${row.race_no}`;
const entryKey = row => `${raceKey(row)}/${row.boat_no}`;
const registration = value => /^0?\d{4}$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;
const jstDate = timestamp => new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function planPreviousDayProgramSave({ raceDate, capturedAt, now, batch, existingEvents, existingEntries }) {
  const capturedMs = Date.parse(capturedAt);
  const nowMs = Date.parse(now);
  const explicitZone = value => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value ?? "");
  if (!explicitZone(capturedAt) || !explicitZone(now) || !Number.isFinite(capturedMs) ||
      !Number.isFinite(nowMs) || capturedMs > nowMs ||
      jstDate(capturedMs) !== jstDate(nowMs) || jstDate(nowMs + 86400000) !== raceDate) {
    return { status: "HOLD", reason: "not_previous_jst_day" };
  }
  if (batch?.status !== "PASS_OFFLINE_ONLY" || !Array.isArray(batch.entries) ||
      !Array.isArray(existingEvents) || !Array.isArray(existingEntries)) {
    return { status: "HOLD", reason: "invalid_save_inputs" };
  }

  const entries = batch.entries.map(row => ({
    ...row, racer_registration_no: registration(row?.racer_registration_no),
  }));
  if (inspectBatch(batch.events, entries, batch.events, raceDate).status !== "PASS_OFFLINE_ONLY") {
    return { status: "HOLD", reason: "invalid_candidate_batch" };
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
