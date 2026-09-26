import test from 'node:test';
import assert from 'node:assert/strict';
import { captureTrinityEntries, buildTrinityPredictionSnapshot, V3_CANDIDATE_01_THRESHOLD } from '../../app/lib/trinitySnapshotV1.js';
import { buildTrinityCoreV2 } from '../../app/lib/trinityCoreV2.js';
import { selectTrinityV3 } from '../../app/lib/trinitySelectiveV3.js';
import { summarizeShadow } from '../../app/lib/trinityShadowMetrics.js';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const capturedAt = new Date().toISOString();
const event = { race_date: today, course_code: 1, race_no: 12, closing_time: '23:59:00' };
const six = Array.from({ length: 6 }, (_, i) => ({ boat_no: i + 1,
  racer_registration_no: 4000 + i, racer_name: `racer${i + 1}`, sex_code: 1,
  national_win_rate: 6.2, local_win_rate: 5.8, motor_2_rate: 35,
  boat_2_rate: 30, average_st: 0.15, exhibition_time: 6.7,
  exhibition_st: 0.12, created_at: capturedAt, updated_at: capturedAt }));

test('previous_day input drops all exhibition and normalizes legacy scales', () => {
  const entries = captureTrinityEntries(six.map(r => ({ ...r, national_win_rate: 620,
    motor_2_rate: 3500 })), 'previous_day', capturedAt);
  assert.equal(entries[0].national_win_rate, 6.2);
  assert.equal(entries[0].motor_2_rate, 35);
  assert.equal('exhibition_time' in entries[0], false);
  const prediction = buildTrinityCoreV2({ event, entries, timing: 'previous_day' });
  const v3 = selectTrinityV3(prediction, { minConfidence: V3_CANDIDATE_01_THRESHOLD });
  const common = { event, entries, prediction, timing: 'previous_day',
    sourceCapturedAt: capturedAt, generatedAt: new Date().toISOString() };
  const v2 = buildTrinityPredictionSnapshot({ ...common,
    engineVersion: 'trinity-core-v2', strategyTag: 'v2_baseline',
    selection: { selected_tickets: prediction.trinity.selected_tickets, reason: 'v2_baseline' } });
  const selective = buildTrinityPredictionSnapshot({ ...common,
    engineVersion: 'trinity-v3-candidate-01', strategyTag: 'ichika_selective', selection: v3 });
  assert.notEqual(v2.prediction_id, selective.prediction_id);
  assert.equal(v2.source_captured_at, selective.source_captured_at);
  assert.equal(v2.top_combination, selective.top_combination);
  assert.equal(v2.boat_features[0].average_st, 0.15);
  assert.equal(v2.odds_snapshot_id, null);
});

test('rejects postclose predictions and future odds', () => {
  const entries = captureTrinityEntries(six, 'previous_day', capturedAt);
  const prediction = buildTrinityCoreV2({ event, entries, timing: 'previous_day' });
  const common = { event, entries, prediction, timing: 'previous_day',
    sourceCapturedAt: capturedAt, generatedAt: new Date().toISOString(),
    engineVersion: 'trinity-core-v2', strategyTag: 'v2_baseline',
    selection: { selected_tickets: prediction.trinity.selected_tickets, reason: 'v2_baseline' } };
  assert.throws(() => buildTrinityPredictionSnapshot({ ...common, event: { ...event, closing_time: '00:01:00' } }));
  assert.throws(() => buildTrinityPredictionSnapshot({ ...common,
    oddsSnapshot: { id: 1, race_date: today, course_code: 1, race_no: 12,
      captured_at: new Date(Date.now() + 60_000).toISOString() } }));
});

test('result metrics use settled rows and exclude the biggest payout', () => {
  const base = { generated_at: capturedAt, race_date: today, course_code: 1, race_no: 1,
    recommendation: 'BUY', ticket_count: 2, investment_yen: 200 };
  const metrics = summarizeShadow([
    { ...base, prediction_id: '1', trinity_prediction_results: { hit: true, payout_yen: 1000 } },
    { ...base, prediction_id: '2', trinity_prediction_results: { hit: false, payout_yen: 0 } },
    { ...base, prediction_id: '3', trinity_prediction_results: null },
  ]);
  assert.equal(metrics.investment, 400);
  assert.equal(metrics.roi, 250);
  assert.equal(metrics.top1_excluded_roi, 0);
  assert.equal(metrics.max_losing_streak, 1);
});
