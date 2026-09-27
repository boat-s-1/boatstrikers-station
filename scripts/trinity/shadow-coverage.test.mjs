import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shadowCoverage } from '../../app/lib/trinityShadowCoverage.js';

const date = '2026-09-28';
const event = (race_no, closing_time = '12:00:00') =>
  ({ race_date: date, course_code: 1, race_no, closing_time });
const prediction = (race_no, engine_version, generated_at = '2026-09-28T02:50:00Z') =>
  ({ race_date: date, course_code: 1, race_no, timing: 'after_exhibition',
    engine_version, generated_at, inserted_at: generated_at,
    source_captured_at: '2026-09-28T02:49:00Z', boat_features: [{ boat_no: 1 }] });

test('counts launch period separately and requires both models with matching contemporaneous input', () => {
  const events = [event(1, '11:00:00'), event(2), event(3), event(4), event(5), event(6)];
  const rows = [
    prediction(2, 'trinity-core-v2'), prediction(2, 'trinity-v3-candidate-01'),
    prediction(3, 'trinity-core-v2'),
    prediction(4, 'trinity-core-v2', '2026-09-28T03:00:01Z'),
    prediction(4, 'trinity-v3-candidate-01', '2026-09-28T03:00:01Z'),
    prediction(5, 'trinity-core-v2'),
    { ...prediction(5, 'trinity-v3-candidate-01'), boat_features: [{ boat_no: 2 }] },
  ];
  const coverage = shadowCoverage(events, rows, Date.parse('2026-09-28T03:10:00Z'),
    Date.parse('2026-09-28T02:01:00Z'));
  assert.deepEqual({ monitored: coverage.monitored, paired: coverage.paired,
    missing: coverage.missing, partial: coverage.partial, late: coverage.late,
    inputMismatch: coverage.inputMismatch, beforeLaunch: coverage.beforeLaunch },
  { monitored: 5, paired: 1, missing: 1, partial: 1, late: 1,
    inputMismatch: 1, beforeLaunch: 1 });
  assert.equal(coverage.rate, 20);
});
