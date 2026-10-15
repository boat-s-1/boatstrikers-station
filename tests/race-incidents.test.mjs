import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeIncidents } from '../lib/raceIncidents.js';
import { techniqueMapFromResults } from '../lib/winningTechnique.js';
import { buildDailyResultDigest } from '../lib/dailyResultDigest.js';
import { buildOutputs, summarizeDataLabIncidents } from '../lib/dataLabSocialGenerator.js';

const event = (course_code, race_no, extra = {}) => ({ course_code, course_name: `場${course_code}`, race_no, race_name: null, race_kind_code: '0001', trifecta: '123', trifecta_payout: 1000, result_available: true, race_cancel_code: null, ...extra });
const confirmed = (course_code, race_no, winning_technique) => ({ course_code, race_no, winning_technique, winning_method: winning_technique, result_status: 'confirmed', race_status: 'finished' });
// codes: 6艇分の result_code（null は未同期）。arrival は完走艇の着順
const race = (course_code, race_no, codes) => codes.map((result_code, i) => ({
  course_code, race_no, boat_no: i + 1, racer_name: `選手 ${i + 1}`,
  arrival_order: /^0[1-6]$/.test(result_code || '') ? Number(result_code) : null, result_code, gender_code: '1',
}));
const synced = (course_code, race_no) => race(course_code, race_no, ['01', '02', '03', '04', '05', '06']);
const unsynced = (course_code, race_no) => race(course_code, race_no, [null, null, null, null, null, null]);
const digestFor = (allEvents, ents, results) => buildDailyResultDigest({ raceDate: '2026-10-16', allEvents, entries: ents, techniqueMap: techniqueMapFromResults(results) });
const twoRaceResults = [confirmed(1, 1, '逃げ'), confirmed(1, 2, '逃げ')];
const incidentSection = (body) => body.split('## 事故・異常着\n')[1].split('\n\n')[0];

test('事故あり：異常コードのあるレース数を数え、ラベルを付ける', () => {
  const s = summarizeIncidents([event(1, 1), event(1, 2)], [...race(1, 1, ['01', 'F', '02', '03', '04', '05']), ...synced(1, 2)]);
  assert.equal(s.status, 'complete');
  assert.equal(s.race_count, 1);
  assert.deepEqual(s.races[0].items.map((x) => [x.boat_no, x.code, x.label]), [[2, 'F', 'フライング']]);
});

test('事故なし：全レース同期済みで異常なしなら 0 件を確定表示する', () => {
  const r = digestFor([event(1, 1), event(1, 2)], [...synced(1, 1), ...synced(1, 2)], twoRaceResults);
  assert.equal(r.dataLab.incident_status, 'complete');
  assert.equal(r.dataLab.incident_race_count, 0);
  assert.equal(incidentSection(r.article.body), '対象となるフライング・出遅れ・欠場・失格は確認されませんでした。');
  assert.match(r.xPost, /⚠️事故・異常着 0R/);
});

test('未同期：異常コードが空なら「集計確認中」で、0 件とは書かない', () => {
  const r = digestFor([event(1, 1), event(1, 2)], [...unsynced(1, 1), ...unsynced(1, 2)], twoRaceResults);
  assert.equal(r.dataLab.incident_status, 'incomplete');
  assert.equal(r.dataLab.incident_race_count, null);
  assert.equal(r.dataLab.incident_unsynced_race_count, 2);
  assert.deepEqual(r.incidents, []);
  assert.equal(incidentSection(r.article.body), 'フライング・出遅れ・欠場・失格は集計確認中です。');
  assert.match(r.xPost, /⚠️事故・異常着 集計確認中/);
});

test('一部同期：1レースでも未同期なら途中の件数は出さない', () => {
  const r = digestFor([event(1, 1), event(1, 2)], [...race(1, 1, ['01', 'S0', '02', '03', '04', '05']), ...unsynced(1, 2)], twoRaceResults);
  assert.equal(r.dataLab.incident_race_count, null);
  assert.equal(r.dataLab.incident_unsynced_race_count, 1);
  assert.equal(incidentSection(r.article.body), 'フライング・出遅れ・欠場・失格は集計確認中です。');
  // 1艇だけ空でも未同期扱い
  const partial = summarizeIncidents([event(1, 1)], race(1, 1, ['01', '02', '03', '04', '05', null]));
  assert.equal(partial.status, 'incomplete');
});

test('出走表が無いレースは未同期扱い、中止レースは対象外', () => {
  assert.equal(summarizeIncidents([event(1, 1), event(1, 2)], synced(1, 1)).status, 'incomplete');
  const s = summarizeDataLabIncidents([event(1, 1), event(1, 2, { race_cancel_code: '1' })], synced(1, 1));
  assert.equal(s.status, 'complete');
  assert.equal(s.race_count, 0);
});

test('返還あり：出遅れ・欠場のレースも事故レースとして数える', () => {
  const ents = [...race(11, 3, ['01', 'L1', '02', '04', '03', '05']), ...race(11, 4, ['K0', '01', '02', '03', '04', '05'])];
  const s = summarizeIncidents([event(11, 3), event(11, 4)], ents);
  assert.equal(s.race_count, 2);
  assert.deepEqual(s.races.map((x) => x.items.map((i) => i.label).join()), ['出遅れ（責任外）', '欠場']);
});

test('結果行欠損：決まり手は保留、事故は出走表から数え、他の集計は変えない', () => {
  // びわこ3R型：返還レースで bs_race_results が無い
  const allEvents = [event(11, 3, { trifecta: '135', trifecta_payout: 590 }), event(11, 4, { trifecta: '524', trifecta_payout: 15000 })];
  const ents = [...race(11, 3, ['01', 'L1', '02', '04', '03', '05']), ...race(11, 4, ['05', '02', '06', '04', '01', '03'])];
  const r = digestFor(allEvents, ents, [confirmed(11, 4, 'まくり')]);
  assert.equal(r.dataLab.technique_status, 'incomplete');
  assert.equal(r.dataLab.escape_wins, null);
  assert.equal(r.dataLab.incident_status, 'complete');
  assert.equal(r.dataLab.incident_race_count, 1);
  assert.equal(r.dataLab.race_count, 2);
  assert.equal(r.dataLab.manshu_count, 1);
  assert.equal(r.dataLab.max_payout, 15000);
  assert.deepEqual(r.dataLab.boat_win_counts, { 1: 1, 2: 0, 3: 0, 4: 0, 5: 1, 6: 0 });
});

test('同期の有無でレース数・万舟・最高配当・艇番別勝利数は変わらない', () => {
  const allEvents = [event(1, 1, { trifecta_payout: 25000 }), event(1, 2)];
  const a = digestFor(allEvents, [...synced(1, 1), ...synced(1, 2)], twoRaceResults).dataLab;
  const b = digestFor(allEvents, [...race(1, 1, ['01', '02', '03', '04', '05', null]), ...race(1, 2, ['01', '02', '03', '04', '05', null])], twoRaceResults).dataLab;
  for (const k of ['race_count', 'venue_count', 'manshu_count', 'manshu_rate', 'max_payout', 'boat1_wins', 'boat5_wins', 'boat_win_counts', 'escape_wins', 'technique_counts']) assert.deepEqual(b[k], a[k], k);
  assert.notEqual(a.incident_race_count, b.incident_race_count);
});

test('DATA LAB：実行時点の同期状況で事故レース数を出す。確認できなければ「集計確認中」', () => {
  const digest = { race_date: '2026-10-16', race_count: 2, venue_count: 1, manshu_count: 0, manshu: [], incidents: [], featured_races: [], data_lab: { incident_race_count: null, incident_status: 'incomplete', boat1_wins: 2, boat5_wins: 0, manshu_rate: 0 } };
  const details = { ichika: { escape_success_count: 2 } };
  const later = buildOutputs(digest, details, summarizeIncidents([event(1, 1), event(1, 2)], [...race(1, 1, ['01', 'F', '02', '03', '04', '05']), ...synced(1, 2)]));
  assert.match(later.x_post_text, /⚠️事故レース 1R/);
  assert.equal(later.image_payload.incident_races, 1);
  const none = buildOutputs(digest, details, summarizeIncidents([event(1, 1)], synced(1, 1)));
  assert.match(none.short_script, /事故レースはありませんでした/);
  const pending = buildOutputs(digest, details, summarizeIncidents([event(1, 1)], unsynced(1, 1)));
  assert.match(pending.x_post_text, /⚠️事故レース 集計確認中/);
  assert.match(pending.short_script, /事故レースは集計確認中です/);
  assert.equal(pending.image_payload.incident_races, null);
  // 旧形式の digest（incident_status なし）だけでは 0 件と見なさない
  const legacy = buildOutputs({ ...digest, data_lab: { incident_race_count: 0 } }, details);
  assert.match(legacy.x_post_text, /集計確認中/);
});
