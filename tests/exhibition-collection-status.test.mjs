import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCollectionStatus, collectionSource, normalizeCollectionDate, validMeasurement } from '../lib/exhibitionCollectionStatus.js';

const date = '2026-08-28';
const rows = (race = 3, extra = {}) => Array.from({ length: 6 }, (_, i) => ({ race_date: date, course_code: 1, race_no: race, boat_no: i + 1, official_lap: 37 + i / 10, official_exhibition_source: 'kiryu_official', official_exhibition_synced_at: `${date}T04:00:00Z`, ...extra }));
const venue = (entries, events = []) => buildCollectionStatus({ date, entries, events })[0];
test('all 24 venues in code order, even without data', () => assert.deepEqual(buildCollectionStatus({ date }).map(row => row.code), Array.from({ length: 24 }, (_, i) => i + 1)));
test('real persisted time and official source, sorted boats', () => {
  const result = venue(rows().reverse());
  assert.deepEqual(result.completed, [{ race: 3, metrics: ['一周'] }]);
  assert.equal(result.latest, `${date}T04:00:00.000Z`);
  assert.deepEqual(result.sources, ['公式']);
});
test('noncontiguous races listed individually', () => assert.deepEqual(venue([...rows(1), ...rows(3)]).completed.map(row => row.race), [1, 3]));
test('different date, venue and invalid race excluded', () => assert.equal(venue([...rows(3, { race_date: '2026-08-27' }), ...rows(3, { course_code: 2 }), ...rows(13)]).completed.length, 0));
test('normal exhibition only is not original data', () => assert.equal(venue(rows(3, { official_lap: null, exhibition_time: 6.7 })).state, '開催登録なし'));
test('scheduled without original data is uncollected, not fetch failed', () => assert.equal(venue([], [{ race_date: date, course_code: 1 }]).state, '未取得'));
for (const value of [0, -1, null, undefined, '', ' ', '-', 'NaN', Infinity, true, []]) test(`invalid measurement ${String(value)}`, () => assert.equal(validMeasurement(value), false));
test('numeric strings accepted', () => assert.equal(validMeasurement('37.12'), true));
test('five boats are partial', () => assert.deepEqual(venue(rows().slice(0, 5)).partial, [3]));
test('duplicate boat never completes race', () => assert.equal(venue([...rows().slice(0, 5), rows()[0]]).completed.length, 0));
test('same metric required on six boats', () => assert.equal(venue(rows().map((row, i) => ({ ...row, official_lap: i < 3 ? 37 : null, official_turn: i >= 3 ? 11 : null }))).completed.length, 0));
test('half lap never treated as full lap', () => assert.deepEqual(venue(rows(3, { official_lap: null, official_half_lap: 18 })).completed[0].metrics, ['半周']));
test('PC data fills missing official metrics', () => {
  const result = venue(rows(3, { official_lap: null, lap_time: 37, official_exhibition_source: null, data_source: 'PC-KYOTEI', exhibition_synced_at: `${date}T03:00:00Z` }));
  assert.equal(result.completed.length, 1);
  assert.deepEqual(result.sources, ['PC-KYOTEI']);
  assert.equal(result.latest, `${date}T03:00:00.000Z`);
});
test('official column can be populated by PC and must retain PC label', () => assert.deepEqual(venue(rows(3, { official_exhibition_source: 'PC_KYOTEI' })).sources, ['PC-KYOTEI']));
test('mixed sources retained', () => assert.deepEqual(venue(rows().map((row, i) => ({ ...row, official_exhibition_source: i < 3 ? 'PC-KYOTEI' : 'kiryu_official' }))).sources, ['PC-KYOTEI', '公式']));
test('API and BOATERS never called official', () => { assert.equal(collectionSource('BOATRACE_OPEN_API'), 'API'); assert.equal(collectionSource('boaters'), 'BOATERS'); assert.equal(collectionSource(null), '不明'); });
test('generic row update is not original update time', () => assert.equal(venue(rows(3, { official_exhibition_synced_at: null, updated_at: `${date}T12:00:00Z`, api_synced_at: `${date}T12:00:00Z` })).latest, null));
test('invalid timestamp remains unknown', () => assert.equal(venue(rows(3, { official_exhibition_synced_at: 'bad' })).latest, null));
test('partial data latest time is included and separately marked', () => {
  const result = venue([...rows(3), ...rows(4, { official_exhibition_synced_at: `${date}T05:00:00Z` }).slice(0, 2)]);
  assert.equal(result.latest, `${date}T05:00:00.000Z`); assert.deepEqual(result.partial, [4]);
});
test('full 1728-boat day covers all24', () => {
  const entries = Array.from({ length: 24 }, (_, i) => Array.from({ length: 12 }, (_, j) => rows(j + 1, { course_code: i + 1 }))).flat(2);
  assert.equal(buildCollectionStatus({ date, entries }).reduce((sum, row) => sum + row.completed.length, 0), 288);
});
test('dates strictly validated including rollover', () => {
  for (const invalid of ['2026-02-30', 'bad', ['2026-08-28'], undefined]) assert.equal(normalizeCollectionDate(invalid, date), date);
  assert.equal(normalizeCollectionDate('2026-08-27', date), '2026-08-27');
});
test('UI server-only read, handles pagination and errors', () => {
  const page = readFileSync(new URL('../app/admin/alerts/collection/page.js', import.meta.url), 'utf8');
  for (const heading of ['オリ展更新時間', '更新済R', '収集元']) assert.ok(page.includes(heading));
  assert.ok(page.includes('.range(900, 1799)'));
  assert.ok(page.includes('role="alert"'));
  for (const mutation of ['.insert(', '.update(', '.upsert(', '.rpc(', '/api/cron']) assert.ok(!page.includes(mutation));
  const client = readFileSync(new URL('../app/admin/alerts/collection/CollectionRefresh.js', import.meta.url), 'utf8');
  assert.ok(!client.includes('SUPABASE')); assert.ok(!client.includes('/api/cron')); assert.ok(client.includes('document.hidden')); assert.ok(client.includes('clearInterval'));
});
