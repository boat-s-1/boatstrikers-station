import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTokuyamaOriginal, verifyTokuyama } from '../lib/tokuyamaVerifiedOriginalTenji.js';
import { fetchBestOriginalTenji } from '../lib/verifiedOriginalTenjiSource.js';

const original = readFileSync(new URL('./fixtures/original-tenji/tokuyama-20260815.html', import.meta.url), 'utf8');
const referenceBase = readFileSync(new URL('./fixtures/original-tenji/tamagawa-reference-20260828.html', import.meta.url), 'utf8');
const race = { courseCode: 18, raceDate: '2026-08-15', raceNo: 10 };
const parsed = parseTokuyamaOriginal(original, race);

function referenceForTokuyama() {
  let html = referenceBase
    .replaceAll('text_place2_05.png', 'text_place2_18.png')
    .replaceAll('jcd=05', 'jcd=18')
    .replaceAll('hd=20260828', 'hd=20260815')
    .replaceAll('8月28日', '8月15日');
  const oldRows = [
    ['5280', '6.82'], ['4630', '6.80'], ['3805', '6.72'],
    ['5066', '6.70'], ['4930', '6.72'], ['4631', '6.82'],
  ];
  for (let i = 0; i < 6; i += 1) {
    html = html.replaceAll(`toban=${oldRows[i][0]}`, `toban=${parsed.rows[i].racerNo}`);
    html = html.replace(`>${oldRows[i][1]}<`, `>${parsed.rows[i].exhibitionTime.toFixed(2)}<`);
  }
  return html;
}

const reference = referenceForTokuyama();

test('actual Tokuyama original fixture parses six boats and three metrics', () => {
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
  assert.equal(parsed.rows.length, 6);
  assert.deepEqual(parsed.rows[0], {
    boatNo: 1, racerNo: '4263', exhibitionTime: 7, lapTime: 37.7, turnTime: 11.72, straightTime: null,
  });
});

test('HTTPS national beforeinfo verifies date, race, roster and exhibition', () => {
  const result = verifyTokuyama(original, reference, race);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.identity.verified, true);
  assert.deepEqual(result.eligibleTheories, { ichika: true, hatsune: true, kiina: false });
});

for (const [name, changed, expected] of [
  ['wrong date', original.replace('2026年08月15日', '2026年08月14日'), 'source_date_mismatch'],
  ['wrong race', original.replace('10R　', '11R　'), 'source_race_mismatch'],
  ['missing lap', original.replace('37.70', '-'), 'measurements_incomplete_or_invalid'],
  ['five boats', original.replace(/<div><span><a\b[^>]*href=['"]#6['"][\s\S]*?<\/div>/i, ''), 'six_unique_boats_required'],
  ['roster mismatch', original.replace('4263', '4264'), 'roster_or_exhibition_mismatch'],
  ['exhibition mismatch', original.replace('展示：7.00', '展示：7.01'), 'roster_or_exhibition_mismatch'],
]) test(`reject ${name}`, () => {
  const result = verifyTokuyama(changed, reference, race);
  assert.equal(result.ok, false);
  assert.equal(result.error, expected);
  assert.deepEqual(result.rows, []);
});

test('production wrapper fetches only fixed sources and never falls through', async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (url, options) => {
      calls += 1;
      assert.equal(options.redirect, 'manual');
      return new Response(url.startsWith('http://www.boatrace-tokuyama.jp/')
        ? new TextEncoder().encode(original) : reference,
      { headers: { 'content-type': 'text/html; charset=utf-8' } });
    };
    const result = await fetchBestOriginalTenji(race);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.sourceKind, 'official');
    assert.equal(result.fallbackUsed, false);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = saved;
  }
});
