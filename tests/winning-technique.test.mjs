import test from 'node:test';
import assert from 'node:assert/strict';
import { WINNING_TECHNIQUES, normalizeTechnique, techniqueMapFromResults, summarizeTechniques } from '../lib/winningTechnique.js';
import { buildDailyResultDigest } from '../lib/dailyResultDigest.js';
import { buildCharacterDetailsFrom, buildOutputs } from '../lib/dataLabSocialGenerator.js';

const confirmed = (course_code, race_no, winning_technique, extra = {}) => ({ course_code, race_no, winning_technique, winning_method: winning_technique, result_status: 'confirmed', race_status: 'finished', ...extra });
const event = (course_code, race_no, extra = {}) => ({ course_code, course_name: `場${course_code}`, race_no, race_name: null, race_kind_code: '0001', trifecta: '123', trifecta_payout: 1000, result_available: true, race_cancel_code: null, ...extra });
// 本番と同じく、完走艇の result_code は "01"〜"06"（同期済みの状態）
const entries = (course_code, race_no, order = [1, 2, 3, 4, 5, 6], extra = {}) => order.map((arrival_order, i) => ({ course_code, race_no, boat_no: i + 1, racer_name: `選手${i + 1}`, arrival_order, result_code: arrival_order ? `0${arrival_order}` : null, gender_code: '1', ...extra }));

test('six official technique labels are recognised and nothing else', () => {
  assert.deepEqual(WINNING_TECHNIQUES, ['逃げ', '差し', 'まくり', 'まくり差し', '抜き', '恵まれ']);
  for (const label of WINNING_TECHNIQUES) assert.equal(normalizeTechnique(label), label);
  assert.equal(normalizeTechnique(' まくり 差し '), 'まくり差し');
  for (const bad of ['2', 2, '', null, undefined, '不明']) assert.equal(normalizeTechnique(bad), null);
});

test('only confirmed finished results feed the technique map; winning_method is the fallback', () => {
  const map = techniqueMapFromResults([
    confirmed(1, 1, '逃げ'),
    confirmed(1, 2, null, { winning_method: '恵まれ' }),
    confirmed(1, 3, '差し', { result_status: 'provisional' }),
    confirmed(1, 4, 'まくり', { race_status: 'cancelled' }),
    confirmed(1, 5, 'まくり差し', { race_status: null }),
    confirmed(1, 6, null),
  ]);
  assert.deepEqual([...map.entries()], [['1-1', '逃げ'], ['1-2', '恵まれ'], ['1-5', 'まくり差し']]);
});

test('counts are published only when every race has a confirmed technique', () => {
  const map = techniqueMapFromResults([confirmed(1, 1, '逃げ'), confirmed(1, 2, '抜き')]);
  const complete = summarizeTechniques([event(1, 1), event(1, 2)], map);
  assert.equal(complete.status, 'complete');
  assert.equal(complete.escape_wins, 1);
  assert.equal(complete.counts['抜き'], 1);
  const incomplete = summarizeTechniques([event(1, 1), event(1, 2), event(1, 3)], map);
  assert.equal(incomplete.status, 'incomplete');
  assert.equal(incomplete.escape_wins, null);
  assert.equal(incomplete.counts, null);
  assert.deepEqual(incomplete.missing_races, [{ course_code: 1, race_no: 3 }]);
});

test('digest ignores winning_technique_code entirely', () => {
  const allEvents = [event(1, 1, { winning_technique_code: '1' }), event(1, 2, { winning_technique_code: '2' }), event(1, 12, { race_kind_code: '0021', winning_technique_code: '7' })];
  const ents = [...entries(1, 1), ...entries(1, 2, [2, 1, 3, 4, 5, 6]), ...entries(1, 12)];
  const techniqueMap = techniqueMapFromResults([confirmed(1, 1, '逃げ'), confirmed(1, 2, '差し'), confirmed(1, 12, '恵まれ')]);
  const a = buildDailyResultDigest({ raceDate: '2026-10-15', allEvents, entries: ents, techniqueMap });
  const flipped = allEvents.map((x) => ({ ...x, winning_technique_code: '2' }));
  const b = buildDailyResultDigest({ raceDate: '2026-10-15', allEvents: flipped, entries: ents, techniqueMap });
  assert.equal(a.dataLab.escape_wins, 1);
  assert.deepEqual(a.dataLab.technique_counts, { 逃げ: 1, 差し: 1, まくり: 0, まくり差し: 0, 抜き: 0, 恵まれ: 1 });
  assert.equal(a.featured[0].winning_technique, '恵まれ');
  assert.match(a.article.body, /- 逃げ決着：1R/);
  assert.match(a.article.body, /決まり手 恵まれ/);
  assert.deepEqual(b.dataLab, a.dataLab);
  assert.equal(b.article.body, a.article.body);
});

test('digest with a race missing its result row keeps other stats and withholds escape counts', () => {
  // 返還（2号艇L1）で bs_race_results が無いレースを含む日：レース数・万舟・1号艇勝利は出し、逃げは出さない
  const allEvents = [event(11, 3, { trifecta: '135', trifecta_payout: 590 }), event(11, 4, { trifecta: '524', trifecta_payout: 15000 })];
  const ents = [...entries(11, 3, [1, null, 2, 4, 3, 5]).map((x) => (x.boat_no === 2 ? { ...x, result_code: 'L1' } : x)), ...entries(11, 4, [4, 2, 6, 5, 1, 3])];
  const r = buildDailyResultDigest({ raceDate: '2026-10-14', allEvents, entries: ents, techniqueMap: techniqueMapFromResults([confirmed(11, 4, 'まくり')]) });
  assert.equal(r.dataLab.race_count, 2);
  assert.equal(r.dataLab.manshu_count, 1);
  assert.equal(r.dataLab.max_payout, 15000);
  assert.equal(r.dataLab.boat1_wins, 1);
  assert.equal(r.dataLab.boat5_wins, 1);
  assert.equal(r.dataLab.incident_race_count, 1);
  assert.equal(r.dataLab.escape_wins, null);
  assert.equal(r.dataLab.technique_status, 'incomplete');
  assert.deepEqual(r.dataLab.technique_missing_races, [{ course_code: 11, race_no: 3 }]);
  assert.doesNotMatch(r.article.body, /逃げ決着/);
  assert.match(r.article.body, /1号艇1着：1R/);
});

test('digest still refuses to publish while any race lacks result_available', () => {
  assert.throws(() => buildDailyResultDigest({ raceDate: '2026-10-15', allEvents: [event(1, 1), event(1, 2, { result_available: false })], entries: [], techniqueMap: new Map() }), /結果未確定/);
});

test('DATA LAB recounts escapes from confirmed techniques instead of the stored digest value', () => {
  const events = [event(1, 1), event(1, 2), event(1, 3)];
  const ents = [...entries(1, 1), ...entries(1, 2, [2, 1, 3, 4, 5, 6]), ...entries(1, 3)];
  const techniqueMap = techniqueMapFromResults([confirmed(1, 1, '逃げ'), confirmed(1, 2, '差し'), confirmed(1, 3, '逃げ')]);
  const digest = { race_date: '2026-10-15', race_count: 3, venue_count: 1, manshu_count: 0, manshu: [], incidents: [], featured_races: [], data_lab: { escape_wins: 1, boat1_wins: 2, boat5_wins: 0, manshu_rate: 0 } };
  const details = buildCharacterDetailsFrom({ events, entries: ents, techniqueMap, digest });
  assert.equal(details.ichika.escape_success_count, 2);
  assert.equal(details.ichika.escape_failure_count, 1);
  assert.equal(details.ichika.escape_rate, 66.7);
  const out = buildOutputs(digest, details, { status: 'complete', race_count: 0, races: [] });
  assert.match(out.x_post_text, /🏁逃げ 2R（66\.7%）/);
  assert.match(out.short_script, /逃げ決着は2レース/);
  assert.deepEqual(out.image_payload.stats.find((x) => x.label === '逃げ'), { label: '逃げ', value: '2R (66.7%)' });
});

test('DATA LAB omits escape figures when a technique is missing', () => {
  const events = [event(1, 1), event(1, 2)];
  const ents = [...entries(1, 1), ...entries(1, 2)];
  const techniqueMap = techniqueMapFromResults([confirmed(1, 1, '逃げ')]);
  const digest = { race_date: '2026-10-14', race_count: 2, venue_count: 1, manshu_count: 0, manshu: [], incidents: [], featured_races: [], data_lab: { escape_wins: 91, boat1_wins: 2, boat5_wins: 0, manshu_rate: 0 } };
  const details = buildCharacterDetailsFrom({ events, entries: ents, techniqueMap, digest });
  assert.equal(details.ichika.escape_success_count, null);
  assert.equal(details.ichika.escape_rate, null);
  assert.deepEqual(details.ichika.strong_venues, []);
  assert.equal(details.hatsune.women_escape_count, null);
  assert.match(details.ichika.comment, /見送り/);
  const out = buildOutputs(digest, details, { status: 'complete', race_count: 0, races: [] });
  assert.doesNotMatch(out.x_post_text, /逃げ/);
  assert.doesNotMatch(out.short_script, /逃げ決着/);
  assert.equal(out.image_payload.stats.some((x) => x.label === '逃げ'), false);
  assert.match(out.x_post_text, /1号艇1着 2R/);
});
