import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseHamanakoAshiyaOriginal,
  verifyHamanakoAshiya,
  fetchHamanakoAshiyaVerifiedOriginalTenji,
} from '../lib/hamanakoAshiyaVerifiedOriginalTenji.js';
import { fetchBestOriginalTenji } from '../lib/verifiedOriginalTenjiSource.js';

const referenceBase = readFileSync(new URL('./fixtures/original-tenji/tamagawa-reference-20260828.html', import.meta.url), 'utf8');
const data = {
  6: [
    ['4208', 6.65, 37.21, 5.08, 8.06], ['3579', 6.68, 37.81, 5.33, 8.01],
    ['3232', 6.74, 37.52, 5.23, 7.97], ['4938', 6.74, 37.54, 5.30, 8.05],
    ['4313', 6.74, 37.45, 5.26, 8.06], ['4900', 6.66, 37.50, 5.59, 7.78],
  ],
  21: [
    ['4584', 6.73, 36.47, 7.45, 7.60], ['4015', 6.74, 36.89, 7.78, 7.65],
    ['4776', 6.74, 36.94, 7.78, 7.69], ['4191', 6.75, 36.71, 7.62, 7.63],
    ['3742', 6.77, 37.53, 7.96, 7.71], ['4358', 6.76, 37.63, 7.93, 7.64],
  ],
};
const oldIds = ['5280', '4630', '3805', '5066', '4930', '4631'];
const oldTimes = ['6.82', '6.80', '6.72', '6.70', '6.72', '6.82'];
const race = (courseCode) => ({ courseCode, raceDate: '2026-09-01', raceNo: 12 });

function originalFor(code) {
  const cells = code === 6
    ? (row) => `<td class="col1">${row.boat}</td><td class="col2"><a href="/profile?toban=${row.id}">選手</a></td><td class="col5">${row.e}</td><td class="col6">${row.l}</td><td class="col7">${row.t}</td><td class="col8">${row.s}</td>`
    : (row) => `<td class="col1">${row.boat}</td><td class="col2"><a href="/profile?toban=${row.id}">選手</a></td><td class="col4">${row.e}</td><td class="col5">${row.l}</td><td class="col6">${row.t}</td><td class="col7">${row.s}</td>`;
  const rows = data[code].map(([id, e, l, t, s], index) => `<tr>${cells({ boat:index + 1, id, e:e.toFixed(2), l:l.toFixed(2), t:t.toFixed(2), s:s.toFixed(2) })}</tr>`).join('');
  const venue = code === 6 ? '<title>BOAT RACE 浜名湖</title>' : '<p>BOATRACE芦屋独自計測値</p>';
  return `${venue}<a data-day="20260901" data-race="12">12R</a><table><tbody>${rows}</tbody></table><table><thead><tr><th>艇</th><th>オリジナル展示データ 展示</th><th>一周</th><th>まわり足</th><th>直線</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function referenceFor(code) {
  let html = referenceBase
    .replaceAll('jcd=05', `jcd=${String(code).padStart(2, '0')}`)
    .replaceAll('hd=20260828', 'hd=20260901')
    .replace('text_place2_05.png', `text_place2_${String(code).padStart(2, '0')}.png`)
    .replace('<span class="tab2_inner">8月28日', '<span class="tab2_inner">9月1日')
    .replace('rno=10&amp;', 'rno=12&amp;');
  data[code].forEach(([id, exhibition], index) => {
    html = html.replaceAll(`toban=${oldIds[index]}`, `toban=${id}`).replaceAll(`/racerphoto/${oldIds[index]}.jpg`, `/racerphoto/${id}.jpg`);
    html = html.replace(`<td rowspan="4">${oldTimes[index]}</td>`, `<td rowspan="4">${exhibition.toFixed(2)}</td>`);
  });
  return html;
}

for (const code of [6, 21]) {
  test(`course ${code} parses and verifies all four metrics for six boats`, () => {
    const parsed = parseHamanakoAshiyaOriginal(originalFor(code), race(code));
    assert.equal(parsed.ok, true);
    assert.equal(parsed.rows.length, 6);
    assert.deepEqual(parsed.rows[0], { boatNo:1, racerNo:data[code][0][0], exhibitionTime:data[code][0][1], lapTime:data[code][0][2], turnTime:data[code][0][3], straightTime:data[code][0][4] });
    const verified = verifyHamanakoAshiya(originalFor(code), referenceFor(code), race(code));
    assert.equal(verified.ok, true);
    assert.equal(verified.identity.verified, true);
    assert.deepEqual(verified.eligibleTheories, { ichika:true, hatsune:true, kiina:true });
  });
}

test('adapter fails closed for wrong identity, venue, missing metric, or five boats', () => {
  assert.equal(parseHamanakoAshiyaOriginal(originalFor(6).replace('20260901', '20260902'), race(6)).error, 'source_identity_mismatch');
  assert.equal(parseHamanakoAshiyaOriginal(originalFor(21).replace('BOATRACE芦屋', '別会場'), race(21)).error, 'source_venue_mismatch');
  assert.equal(parseHamanakoAshiyaOriginal(originalFor(6).replaceAll('>8.06<', '>-<'), race(6)).error, 'measurements_incomplete_or_invalid');
  assert.equal(parseHamanakoAshiyaOriginal(originalFor(21).replace(/<tr><td class="col1">6[\s\S]*?<\/tr>/g, ''), race(21)).error, 'six_unique_boats_required');
});

test('national roster or exhibition mismatch is rejected', () => {
  assert.equal(verifyHamanakoAshiya(originalFor(6), referenceFor(6).replace('toban=4208', 'toban=9999'), race(6)).error, 'reference_boat_identity_invalid');
  assert.equal(verifyHamanakoAshiya(originalFor(21), referenceFor(21).replace('<td rowspan="4">6.73</td>', '<td rowspan="4">6.74</td>'), race(21)).error, 'roster_or_exhibition_mismatch');
});

test('verified source routes fixed HTTPS official and national URLs', async () => {
  const previous = global.fetch;
  const seen = [];
  global.fetch = async (url) => {
    seen.push(String(url));
    const html = String(url).includes('boatrace.jp/owpc/') ? referenceFor(21) : originalFor(21);
    return new Response(html, { status:200 });
  };
  try {
    const direct = await fetchHamanakoAshiyaVerifiedOriginalTenji(race(21));
    const common = await fetchBestOriginalTenji(race(21));
    assert.equal(direct.ok, true);
    assert.equal(common.ok, true);
    assert.equal(common.sourceKind, 'official');
    assert.ok(seen.every((url) => url.startsWith('https://')));
    assert.ok(seen.some((url) => url.includes('ajax_yosou.php?targetday=20260901&race=12&req=cyokuzen&run=0')));
  } finally {
    global.fetch = previous;
  }
});
