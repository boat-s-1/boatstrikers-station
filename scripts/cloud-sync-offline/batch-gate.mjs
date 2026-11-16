import { inspectRaceKeys } from "./race-key-gate.mjs";
import { inspectSixBoatEntries } from "./six-boat-gate.mjs";

// Fail closed before any future writer is permitted to run.
// The source must supply a complete list of expected race keys independently.
export function inspectBatch(events, entries, expectedKeys, date) {
  const issues = [];
  if (!Array.isArray(expectedKeys) || expectedKeys.length === 0) issues.push("missing_expected_manifest");
  if (!Array.isArray(events) || events.length === 0) issues.push("empty_events");
  if (!Array.isArray(entries) || entries.length === 0) issues.push("empty_entries");
  if (issues.length) return { status: "HOLD", issues };
  const manifest = inspectRaceKeys(expectedKeys, date);
  const eventGate = inspectRaceKeys(events, date);
  const entryGate = inspectSixBoatEntries(entries, date);
  if (manifest.status !== "PASS_OFFLINE_ONLY") issues.push("invalid_manifest");
  if (eventGate.status !== "PASS_OFFLINE_ONLY") issues.push("invalid_events");
  if (entryGate.status !== "PASS_OFFLINE_ONLY") issues.push("invalid_entries");
  if (issues.length) return { status: "HOLD", issues };
  const key = r => `${r.race_date}/${r.course_code}/${r.race_no}`;
  const manifestKeys = new Set(expectedKeys.map(key));
  const eventKeys = new Set(events.map(key));
  const entryKeys = new Set(entries.map(key));
  if (manifestKeys.size !== eventKeys.size || [...manifestKeys].some(k => !eventKeys.has(k))) issues.push("event_manifest_mismatch");
  if (manifestKeys.size !== entryKeys.size || [...manifestKeys].some(k => !entryKeys.has(k))) issues.push("entry_manifest_mismatch");
  return { status: issues.length ? "HOLD" : "PASS_OFFLINE_ONLY", issues, races: manifestKeys.size };
}
