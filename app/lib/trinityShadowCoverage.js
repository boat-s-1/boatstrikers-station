import { closingAt } from './trinitySnapshotV1.js';

const VERSIONS = ['trinity-core-v2', 'trinity-v3-candidate-01'];
const raceKey = row => `${row.race_date}:${row.course_code}:${row.race_no}`;

// A closing race is counted even when the input was not available. Readiness is
// a separate question that cannot be inferred from mutable current entry rows.
export function shadowCoverage(events, snapshots, now = Date.now(), startedAt = null) {
  const byRace = new Map();
  for (const snapshot of snapshots) {
    if (snapshot.timing !== 'after_exhibition') continue;
    const key = raceKey(snapshot);
    if (!byRace.has(key)) byRace.set(key, []);
    byRace.get(key).push(snapshot);
  }
  const races = events.flatMap(event => {
    const deadline = closingAt(event);
    if (!Number.isFinite(deadline) || deadline > now) return [];
    const found = byRace.get(raceKey(event)) || [];
    const v2 = found.find(row => row.engine_version === VERSIONS[0]);
    const v3 = found.find(row => row.engine_version === VERSIONS[1]);
    const beforeLaunch = startedAt != null && deadline <= startedAt;
    const timely = row => row && Date.parse(row.generated_at) < deadline &&
      Date.parse(row.inserted_at) < deadline;
    const sameInput = v2 && v3 && v2.source_captured_at === v3.source_captured_at &&
      v2.generated_at === v3.generated_at &&
      JSON.stringify(v2.boat_features) === JSON.stringify(v3.boat_features);
    return [{ ...event, deadline, status: beforeLaunch ? 'before_launch' :
      !v2 && !v3 ? 'missing' :
      !v2 || !v3 ? 'partial' :
      !timely(v2) || !timely(v3) ? 'late' :
      !sameInput ? 'input_mismatch' : 'paired' }];
  });
  const monitored = races.filter(r => r.status !== 'before_launch');
  const paired = monitored.filter(r => r.status === 'paired').length;
  return { races, monitored: monitored.length, paired,
    rate: monitored.length ? 100 * paired / monitored.length : null,
    missing: monitored.filter(r => r.status === 'missing').length,
    partial: monitored.filter(r => r.status === 'partial').length,
    late: monitored.filter(r => r.status === 'late').length,
    inputMismatch: monitored.filter(r => r.status === 'input_mismatch').length,
    beforeLaunch: races.length - monitored.length };
}
