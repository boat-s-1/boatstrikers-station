import assert from 'node:assert/strict';
import { test } from 'node:test';
import { officialCourses, parseOfficialRacelist } from '../../app/lib/trinityOfficialRacelist.js';

const date = '20260928';
const links = Array.from({ length: 12 }, (_, i) =>
  `<a href="/owpc/pc/race/racelist?rno=${i + 1}&amp;jcd=02&amp;hd=${date}">${i + 1}R</a>`).join('');
const group = boat => `<tbody class=" is-fs12"><tr>
  <td class="is-boatColor${boat}" rowspan="4">${boat}</td><td rowspan="4">画像</td>
  <td rowspan="4"><div class="is-fs11">${3380 + boat} / B1</div>
  <div class="is-fs18 is-fBold"><a href="/owpc/pc/data/racersearch/profile?toban=${3380 + boat}">選手　${boat}</a></div></td>
  <td rowspan="4">F0<br>L0<br>0.15</td>
  <td rowspan="4">5.07<br>30.43<br>48.91</td>
  <td rowspan="4">5.85<br>39.84<br>59.38</td>
  <td rowspan="4">23<br>29.63<br>62.96</td>
  <td rowspan="4">75<br>5.00<br>15.00</td></tr></tbody>`;
const document = `<html><a href="/owpc/pc/race/racelist?rno=1&amp;jcd=02&amp;hd=${date}">出走表</a>
  ${links}<table><tr><td colspan="2">締切予定時刻</td>
  ${Array.from({ length: 12 }, (_, i) => `<td>${10 + Math.floor(i / 2)}:${i % 2 ? '30' : '00'}</td>`).join('')}</tr></table>
  <table>${Array.from({ length: 6 }, (_, i) => group(i + 1)).join('')}</table></html>`;

test('extracts six official entry vectors and closing time without exhibition data', () => {
  assert.deepEqual(officialCourses(document, date), [2]);
  const parsed = parseOfficialRacelist(document, { raceDate: '2026-09-28', courseCode: 2, raceNo: 1 });
  assert.equal(parsed.closing_time, '10:00');
  assert.equal(parsed.entries.length, 6);
  assert.deepEqual(parsed.entries[0], {
    boat_no: 1, racer_registration_no: '03381', racer_name: '選手1',
    average_st: 0.15, national_win_rate: 5.07, local_win_rate: 5.85,
    motor_2_rate: 29.63, boat_2_rate: 5,
  });
  assert.equal(parsed.source_sha256.length, 64);
  assert.ok(parsed.entries.every(e => !('exhibition_time' in e)));
});

test('rejects missing, wrong date, and incorrectly keyed entry lists', () => {
  assert.throws(() => parseOfficialRacelist(document.replace('23<br>29.63', '23<br>-'),
    { raceDate: '2026-09-28', courseCode: 2, raceNo: 1 }), /incomplete/);
  assert.throws(() => parseOfficialRacelist(document,
    { raceDate: '2026-09-29', courseCode: 2, raceNo: 1 }), /date/);
  assert.throws(() => parseOfficialRacelist(document,
    { raceDate: '2026-09-28', courseCode: 3, raceNo: 1 }), /race key/);
});
