import { inspectBatch } from './batch-gate.mjs';
import { mapBrdbProgramRoster } from './brdb-program-roster.mjs';

const raceKey = row => `${row.race_date}/${row.course_code}/${row.race_no}`;
const boatKey = row => `${raceKey(row)}/${row.boat_no}`;

// `officialRaces` and `officialEntries` must come from an independently
// collected official manifest, never from the BRDB response being checked.
export function compareBrdbWithOfficial({ targetDate, records, officialRaces, officialEntries }) {
  const mapped = mapBrdbProgramRoster(records, targetDate);
  if (mapped.status !== 'CANDIDATE_ONLY') return { status: 'HOLD', reason: mapped.status };
  const raceDate = mapped.rows[0].race_date;
  if (!Array.isArray(officialRaces) || !Array.isArray(officialEntries) ||
      inspectBatch(officialRaces, officialEntries, officialRaces, raceDate).status !== 'PASS_OFFLINE_ONLY') {
    return { status: 'HOLD', reason: 'invalid_independent_manifest' };
  }
  const candidateRaces = [...new Map(mapped.rows.map(row => [raceKey(row), {
    race_date: row.race_date, course_code: row.course_code, race_no: row.race_no,
  }])).values()];
  if (inspectBatch(candidateRaces, mapped.rows, officialRaces, raceDate).status !== 'PASS_OFFLINE_ONLY') {
    return { status: 'HOLD', reason: 'race_coverage_mismatch' };
  }
  const expected = new Map(officialEntries.map(row => [boatKey(row), Number(row.racer_registration_no)]));
  if (mapped.rows.some(row => Number(row.racer_registration_no) !== expected.get(boatKey(row)))) {
    return { status: 'HOLD', reason: 'registration_mismatch' };
  }
  return { status: 'MATCHED_OFFLINE_ONLY', races: candidateRaces.length, boats: mapped.rows.length };
}
