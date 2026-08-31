import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseShimonosekiWakamatsuOriginal,
  verifyShimonosekiWakamatsu,
} from '../lib/shimonosekiWakamatsuVerifiedOriginalTenji.js';
import { fetchBestOriginalTenji } from '../lib/verifiedOriginalTenjiSource.js';

const referenceBase = readFileSync(new URL('./fixtures/original-tenji/tamagawa-reference-20260828.html', import.meta.url), 'utf8');
const oldRows = [
  ['5280', '6.82'], ['4630', '6.80'], ['3805', '6.72'],
  ['5066', '6.70'], ['4930', '6.72'], ['4631', '6.82'],
];
const venueRows = {
  19: [
    ['4381', '6.82', '37.10', '5.67', '7.39'],
    ['3951', '6.80', '37.67', '5.77', '7.56'],
    ['5083', '6.72', '37.50', '5.54', '7.51'],
    ['3721', '6.70', '37.18', '5.42', '7.58'],
    ['4562', '6.72', '38.01', '5.60', '7.63'],
    ['5459', '6.82', '38.13', '6.16', '7.45'],
  ],
  20: [
    ['3489', '6.82', '37.70', '5.78', '6.27'],
    ['3257', '6.80', '37.51', '5.67', '6.12'],
    ['4105', '6.72', '37.89', '5.75', '6.29'],
    ['3769', '6.70', '38.57', '6.04', '6.33'],
    ['3726', '6.72', '38.48', '6.34', '6.29'],
    ['3535', '6.82', '38.45', '6.04', '6.37'],
  ],
};

function originalFor(courseCode, rows = venueRows[courseCode]) {
  const name = courseCode === 19 ? '下関' : '若松';
  const body = rows.map(([racerNo, exhibition, lap, turn, straight], index) => {
    const boat = index + 1;
    return `<tr class='${boat % 2 ? 'odd' : 'even'}'>`
      + `<td rowspan='2' class='col1 waku tei_color${boat} '>${boat}</td>`
      + `<td rowspan='2' class='col2 tei_sub_color${boat} com-racer-data'>`
      + `<a href='https://www.boatrace.jp/owpc/pc/data/racersearch/profile?toban=${racerNo}'>選手</a></td>`
      + `<td rowspan='2' class='col5'>${exhibition}</td>`
      + `<td class='col6' rowspan='2'>${lap}</td>`
      + `<td class='col7' rowspan='2'>${turn}</td>`
      + `<td class='col8' rowspan='2'>${straight}</td></tr>`;
  }).join('');
  return `<!doctype html><html><head><title>BOAT RACE ${name}</title></head><body>`
    + `<li class='link selected' data-kind='2'><a data-kind='2' data-day='20260831' data-race='10'>オリジナル展示データ</a></li>`
    + `<table class='oriten'><thead><tr><th>枠</th><th>展示タイム</th><th>一周</th><th>まわり足</th><th>直線</th></tr></thead>`
    + `<tbody>${body}</tbody></table></body></html>`;
}

function referenceFor(courseCode, rows = venueRows[courseCode]) {
  let html = referenceBase
    .replaceAll('text_place2_05.png', `text_place2_${courseCode}.png`)
    .replaceAll('jcd=05', `jcd=${courseCode}`)
    .replaceAll('hd=20260828', 'hd=20260831')
    .replaceAll('8月28日', '8月31日');
  for (let index = 0; index < 6; index += 1) {
    html = html.replaceAll(`toban=${oldRows[index][0]}`, `toban=${rows[index][0]}`);
    html = html.replace(`>${oldRows[index][1]}<`, `>${rows[index][1]}<`);
  }
  return html;
}

for (const courseCode of [19, 20]) {
  const race = { courseCode, raceDate: '2026-08-31', raceNo: 10 };
  const original = originalFor(courseCode);
  const reference = referenceFor(courseCode);

  test(`${courseCode} parses six boats and all four timing metrics`, () => {
    const result = parseShimonosekiWakamatsuOriginal(original, race);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.rows.length, 6);
    assert.equal(result.rows.every((row) => [row.exhibitionTime, row.lapTime, row.turnTime, row.straightTime].every(Number.isFinite)), true);
  });

  test(`${courseCode} verifies national date, race, roster and exhibition`, () => {
    const result = verifyShimonosekiWakamatsu(original, reference, race);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.identity.verified, true);
    assert.deepEqual(result.eligibleTheories, { ichika: true, hatsune: true, kiina: true });
  });
}

const shimonosekiRace = { courseCode: 19, raceDate: '2026-08-31', raceNo: 10 };
const shimonoseki = originalFor(19);
const shimonosekiReference = referenceFor(19);
for (const [name, changed, expected] of [
  ['wrong venue', shimonoseki.replace('下関', '若松'), 'source_venue_mismatch'],
  ['wrong day', shimonoseki.replace("data-day='20260831'", "data-day='20260830'"), 'source_identity_mismatch'],
  ['wrong race', shimonoseki.replace("data-race='10'", "data-race='11'"), 'source_identity_mismatch'],
  ['missing straight', shimonoseki.replace("class='col8' rowspan='2'>7.39", "class='col8' rowspan='2'>-"), 'measurements_incomplete_or_invalid'],
  ['five boats', originalFor(19, venueRows[19].slice(0, 5)), 'six_unique_boats_required'],
  ['roster mismatch', shimonoseki.replace('toban=4381', 'toban=4382'), 'roster_or_exhibition_mismatch'],
]) test(`reject ${name}`, () => {
  const result = verifyShimonosekiWakamatsu(changed, shimonosekiReference, shimonosekiRace);
  assert.equal(result.ok, false);
  assert.equal(result.error, expected);
  assert.deepEqual(result.rows, []);
});

test('production wrapper keeps both venues on fixed HTTPS origins', async () => {
  const saved = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      const value = String(url);
      calls.push(value);
      assert.equal(options.redirect, 'manual');
      const courseCode = value.includes('boatrace-shimonoseki') ? 19 : value.includes('wmb.jp') ? 20 : Number(new URL(value).searchParams.get('jcd'));
      const body = value.includes('boatrace.jp/owpc/pc/race/beforeinfo') ? referenceFor(courseCode) : originalFor(courseCode);
      return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    };
    for (const courseCode of [19, 20]) {
      const result = await fetchBestOriginalTenji({ courseCode, raceDate: '2026-08-31', raceNo: 10 });
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.sourceKind, 'official');
      assert.equal(result.fallbackUsed, false);
    }
    assert.equal(calls.length, 4);
    assert.equal(calls.some((url) => url.startsWith('https://www.boatrace-shimonoseki.jp/') && url.includes('kind=2')), true);
    assert.equal(calls.some((url) => url.startsWith('https://www.wmb.jp/') && url.includes('kind=2')), true);
  } finally {
    globalThis.fetch = saved;
  }
});
