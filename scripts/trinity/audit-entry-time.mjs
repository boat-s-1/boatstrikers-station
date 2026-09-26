import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/trinity/audit-entry-time.mjs <race-time-export.jsonl> <graded-races.csv>');
const bytes = readFileSync(input);
const records = bytes.toString('utf8').trim().split('\n').flatMap(line => JSON.parse(line));
const grades = { 'SAFE-A': 0, 'SAFE-B': 0, UNSAFE: 0 };
const reasons = {};
const rows = [];
for (const [date, course, race, closing, firstCreated, lastCreated, lastUpdated, predictionAt, entryCount] of records) {
  // The historical DB supplies closing_time, while deadline_time is entirely NULL.
  // July is UTC+9 without daylight saving time.
  const closeAt = closing && closing !== '00:00:00' ? `${date}T${closing}+09:00` : null;
  const closeMs = closeAt ? Date.parse(closeAt) : NaN;
  const predictedBeforeClose = predictionAt && Date.parse(predictionAt) < closeMs;
  let grade, reason;
  if (entryCount !== 6 || !Number.isFinite(closeMs)) {
    grade = 'UNSAFE'; reason = 'missing_valid_race_cutoff_or_six_entries';
  } else if (Date.parse(lastCreated) > closeMs) {
    grade = 'UNSAFE'; reason = 'entry_created_after_closing';
  } else if (predictedBeforeClose && Date.parse(lastUpdated) <= Date.parse(predictionAt)) {
    // A saved prediction timestamp is only a proxy for TRINITY publication.
    // To certify SAFE-A the six *feature values* must also be shown identical
    // in a separately stored immutable as-of snapshot.
    grade = 'SAFE-B'; reason = 'timestamps_precede_proxy_but_no_feature_snapshot';
  } else {
    grade = 'SAFE-B'; reason = 'pre_close_creation_but_later_update_or_no_snapshot';
  }
  grades[grade]++;
  reasons[reason] = (reasons[reason] || 0) + 1;
  rows.push([date, course, race, closing, firstCreated, lastCreated, lastUpdated,
    predictionAt || '', entryCount, grade, reason]);
}
rows.sort((a,b) => `${a[0]}:${String(a[1]).padStart(2,'0')}:${String(a[2]).padStart(2,'0')}`
  .localeCompare(`${b[0]}:${String(b[1]).padStart(2,'0')}:${String(b[2]).padStart(2,'0')}`));
const header = 'race_date,course_code,race_no,closing_time_jst,first_created_at,last_created_at,last_updated_at,proxy_prediction_at,entry_count,safe_grade,reason';
writeFileSync(output, header + '\n' + rows.map(row => row.join(',')).join('\n') + '\n');
console.log(JSON.stringify({ input_sha256: createHash('sha256').update(bytes).digest('hex'),
  races: rows.length, grades, reasons, grading_basis: 'Current rows; SAFE-A requires immutable feature evidence and therefore remains zero' }, null, 2));
