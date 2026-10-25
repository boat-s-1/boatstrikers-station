import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeIncidents } from '../lib/raceIncidents.js';
import { techniqueMapFromResults } from '../lib/winningTechnique.js';
import { buildDailyResultDigest } from '../lib/dailyResultDigest.js';
import { buildOutputs, summarizeDataLabIncidents } from '../lib/dataLabSocialGenerator.js';

const event = (course_code, race_no, extra = {}) => ({ course_code, course_name: `場${course_code}`, race_no, race_name: null, race_kind_code: '0001', trifecta: '123', trifecta_payout: 1000, result_available: true, race_cancel_code: null, ...extra });
const confirmed = (course_code, race_no, winning_technique) => ({ course_code, race_no, winning_technique, winning_method: winning_technique, result_status: 'confirmed', race_status: 'finished' });
// codes: 6艇分の result_code（null は未同期）。arrival は完走艇の着順
// marks: 6艇分の公式着順欄の記号（finish_place）。省略時は本番でよく見る組み合わせ（S0/S1→転、K→欠、S2→妨 など）
const DEFAULT_MARK = { F: 'F', L0: 'L', L1: 'L', K0: '欠', K1: '欠', S0: '転', S1: '転', S2: '妨' };
const race = (course_code, race_no, codes, marks = []) => codes.map((result_code, i) => ({
  course_code, race_no, boat_no: i + 1, racer_name: `選手 ${i + 1}`,
  arrival_order: /^0[1-6]$/.test(result_code || '') ? Number(result_code) : null, result_code, gender_code: '1',
  finish_place: marks[i] !== undefined ? marks[i] : (result_code == null ? null : (/^0[1-6]$/.test(result_code) ? String(Number(result_code)) : DEFAULT_MARK[result_code] ?? null)),
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
  assert.equal(incidentSection(r.article.body), '公式結果の着順欄で、事故・異常着は確認されませんでした。');
  assert.match(r.xPost, /⚠️事故・異常着 0R/);
});

test('未同期：異常コードが空なら「集計確認中」で、0 件とは書かない', () => {
  const r = digestFor([event(1, 1), event(1, 2)], [...unsynced(1, 1), ...unsynced(1, 2)], twoRaceResults);
  assert.equal(r.dataLab.incident_status, 'incomplete');
  assert.equal(r.dataLab.incident_race_count, null);
  assert.equal(r.dataLab.incident_unsynced_race_count, 2);
  assert.deepEqual(r.incidents, []);
  assert.equal(incidentSection(r.article.body), '事故・異常着は集計確認中です。');
  assert.match(r.xPost, /⚠️事故・異常着 集計確認中/);
});

test('一部同期：1レースでも未同期なら途中の件数は出さない', () => {
  const r = digestFor([event(1, 1), event(1, 2)], [...race(1, 1, ['01', 'S0', '02', '03', '04', '05']), ...unsynced(1, 2)], twoRaceResults);
  assert.equal(r.dataLab.incident_race_count, null);
  assert.equal(r.dataLab.incident_unsynced_race_count, 1);
  assert.equal(incidentSection(r.article.body), '事故・異常着は集計確認中です。');
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
  assert.deepEqual(s.races.map((x) => x.items.map((i) => i.label).join()), ['出遅れ', '欠場']);
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

// ---- 公式着順欄の記号による表記（PHASE 3-D の訂正済み記事と同じ表記ルール） ----
import { FINISH_MARK_LABELS, INCIDENT_NOTE, UNKNOWN_MARK_LABEL, finishMarkLabel, normalizeFinishMark } from '../lib/raceIncidents.js';
import { cancelledRacesText } from '../lib/dailyResultDigest.js';

test('公式記号の読み替え：転・F・落・沈・エ・不・妨・欠・L・失。責任区分は付けない', () => {
  assert.deepEqual(FINISH_MARK_LABELS, { F: 'フライング', L: '出遅れ', 転: '転覆', 落: '落水', 沈: '沈没', エ: 'エンスト', 不: '不完走', 妨: '妨害', 欠: '欠場', 失: '失格' });
  for (const label of Object.values(FINISH_MARK_LABELS)) assert.doesNotMatch(label, /責任外|他艇を/);
  assert.equal(normalizeFinishMark('Ｆ'), 'F');
  assert.equal(normalizeFinishMark(' 転 '), '転');
  for (const finished of ['1', '6', '', null, undefined]) assert.equal(normalizeFinishMark(finished), null);
  assert.equal(finishMarkLabel('Ｌ'), '出遅れ');
  // 公式記号が無い・未知の記号は推測しない
  assert.equal(finishMarkLabel(null), UNKNOWN_MARK_LABEL);
  assert.equal(finishMarkLabel('？'), UNKNOWN_MARK_LABEL);
});

test('表記は finish_place から作り、result_code の責任区分（S0/S1/K1/L1/S2）は使わない', () => {
  const ents = race(1, 1, ['S1', 'S0', 'K1', 'L1', 'S2', 'S1'], ['転', '落', '欠', 'L', '妨', '沈']);
  const s = summarizeIncidents([event(1, 1)], ents);
  assert.deepEqual(s.races[0].items.map((x) => [x.boat_no, x.code, x.mark, x.label]), [
    [1, 'S1', '転', '転覆'], [2, 'S0', '落', '落水'], [3, 'K1', '欠', '欠場'], [4, 'L1', 'L', '出遅れ'], [5, 'S2', '妨', '妨害'], [6, 'S1', '沈', '沈没'],
  ]);
  // 公式記号が取れていない艇は「異常着」（件数には含める）
  const noMark = summarizeIncidents([event(1, 2)], race(1, 2, ['S1', '01', '02', '03', '04', '05'], [null]));
  assert.equal(noMark.race_count, 1);
  assert.equal(noMark.races[0].items[0].label, '異常着');
});

test('件数の数え方は従来どおり result_code で判定する（記号だけあっても未同期は未同期）', () => {
  // 同じ1レースに複数艇の事故があっても 1R
  const s = summarizeIncidents([event(1, 1), event(1, 2)], [...race(1, 1, ['S0', 'S1', '01', '02', '03', '04']), ...synced(1, 2)]);
  assert.equal(s.race_count, 1);
  // result_code が空で記号だけある行は従来どおり未同期扱い（件数を確定しない）
  const pending = summarizeIncidents([event(1, 1)], race(1, 1, [null, '01', '02', '03', '04', '05'], ['転']));
  assert.equal(pending.status, 'incomplete');
});

test('記事：事故があれば注記を付け、責任区分の語は注記以外に出さない', () => {
  const allEvents = [event(1, 1), event(1, 2)];
  const ents = [...race(1, 1, ['S1', 'S0', '01', '02', 'K1', 'S2'], ['転', 'エ', '1', '2', '欠', '妨']), ...synced(1, 2)];
  const r = digestFor(allEvents, ents, twoRaceResults);
  const section = incidentSection(r.article.body);
  assert.equal(section, ['- 場11R：1号艇 選手1：転覆、2号艇 選手2：エンスト、5号艇 選手5：欠場、6号艇 選手6：妨害', INCIDENT_NOTE].join('\n'));
  assert.doesNotMatch(r.article.body.replace(INCIDENT_NOTE, ''), /失格|責任外|他艇を妨害/);
  // 事故が無い日は注記を付けない
  const none = digestFor(allEvents, [...synced(1, 1), ...synced(1, 2)], twoRaceResults);
  assert.equal(none.article.body.includes(INCIDENT_NOTE), false);
});

test('中止レースの注記：中止がある日だけ「全○Rのうち…が中止となったため、○Rを集計対象」', () => {
  const allEvents = [event(1, 1), event(1, 2), event(20, 12, { course_name: '若松', race_cancel_code: 'official_cancelled', result_available: false, trifecta: null, trifecta_payout: null })];
  const r = digestFor(allEvents, [...synced(1, 1), ...synced(1, 2)], twoRaceResults);
  assert.equal(r.dataLab.race_count, 2);
  assert.match(r.article.body, /^- 開催：1場 \/ 2R$/m);
  assert.match(r.article.body, /^※全3Rのうち若松12Rが中止となったため、2Rを集計対象としました。$/m);
  // 中止が無い日は出さない
  const plain = digestFor([event(1, 1), event(1, 2)], [...synced(1, 1), ...synced(1, 2)], twoRaceResults);
  assert.doesNotMatch(plain.article.body, /中止となったため/);
});

test('中止レースの書き方：場ごとにまとめ、連続するレースは範囲で書く', () => {
  const c = (course_code, course_name, race_no) => ({ course_code, course_name, race_no });
  assert.equal(cancelledRacesText([c(20, '若松', 12)]), '若松12R');
  assert.equal(cancelledRacesText([c(4, '平和島', 5), c(1, '桐生', 2), c(4, '平和島', 3), c(1, '桐生', 1), c(1, '桐生', 3)]), '桐生1〜3R、平和島3R・5R');
  assert.equal(cancelledRacesText(Array.from({ length: 12 }, (_, i) => c(6, '浜名湖', i + 1))), '浜名湖1〜12R');
  assert.equal(cancelledRacesText([]), '');
});
