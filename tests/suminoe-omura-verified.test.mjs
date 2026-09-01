import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHistoricalOriginalTenji } from '../lib/historicalOriginalTenji.js';
import { verifySuminoeOmura } from '../lib/suminoeOmuraVerifiedOriginalTenji.js';
import { fetchBestOriginalTenji } from '../lib/verifiedOriginalTenjiSource.js';

const referenceBase = readFileSync(new URL('./fixtures/original-tenji/tamagawa-reference-20260828.html', import.meta.url), 'utf8');
const oldRows = [
  ['5280', '廣瀬　　　凜', '6.82'], ['4630', '岩永　　雅人', '6.80'],
  ['3805', '高橋　　英之', '6.72'], ['5066', '鈴木　　孝明', '6.70'],
  ['4930', '佐藤　　　悠', '6.72'], ['4631', '新井　　英孝', '6.82'],
];

const cases = [
  { code: 12, file: 'suminoe-20260818.html', date: '2026-08-18', raceNo: 10 },
  { code: 24, file: 'omura-20260717.html', date: '2026-07-17', raceNo: 3 },
].map((item) => {
  const race = { courseCode: item.code, raceDate: item.date, raceNo: item.raceNo };
  const original = readFileSync(new URL(`./fixtures/original-tenji/${item.file}`, import.meta.url), 'utf8');
  const candidates = parseHistoricalOriginalTenji(original, race).candidateRows;
  return { ...item, race, original, candidates };
});

function referenceFor(item, order = item.candidates) {
  const day = item.date.replaceAll('-', '');
  let html = referenceBase
    .replaceAll('text_place2_05.png', `text_place2_${item.code}.png`)
    .replaceAll('jcd=05', `jcd=${item.code}`)
    .replaceAll('hd=20260828', `hd=${day}`)
    .replaceAll('8月28日', `${Number(item.date.slice(5, 7))}月${Number(item.date.slice(8))}日`);
  if (item.raceNo !== 10) html = html.replaceAll('rno=10', `rno=${item.raceNo}`);
  for (let index = 0; index < 6; index += 1) {
    const candidate = order[index];
    const racerNo = item.code === 12 ? candidate.racerNo : String(6001 + index);
    const name = item.code === 24 ? candidate.racerName : `住之江選手${index + 1}`;
    html = html.replaceAll(`toban=${oldRows[index][0]}`, `toban=${racerNo}`);
    html = html.replace(oldRows[index][1], name);
    html = html.replace(`>${oldRows[index][2]}<`, `>${candidate.exhibitionTime.toFixed(2)}<`);
  }
  return html;
}

for (const item of cases) {
  test(`${item.code}: official page is mapped to six national boat identities`, () => {
    const order = item.code === 24 ? [item.candidates[1], item.candidates[0], ...item.candidates.slice(2)] : item.candidates;
    const result = verifySuminoeOmura(item.original, referenceFor(item, order), item.race);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.rows.length, 6);
    assert.equal(result.identity.verified, true);
    assert.deepEqual(result.eligibleTheories, { ichika: true, hatsune: true, kiina: item.code === 24 });
    if (item.code === 24) {
      assert.equal(result.rows[0].racerName, item.candidates[1].racerName);
      assert.equal(result.rows[0].exhibitionCourse, 2);
    }
  });

  for (const [name, reference, expected] of [
    ['wrong venue', referenceFor(item).replace(`text_place2_${item.code}.png`, 'text_place2_01.png'), 'source_venue_mismatch'],
    ['wrong roster', referenceFor(item).replace(item.code === 12 ? 'toban=3963' : item.candidates[0].racerName, item.code === 12 ? 'toban=3964' : '別の選手'), item.code === 12 ? 'reference_boat_identity_invalid' : 'roster_or_exhibition_mismatch'],
    ['wrong exhibition', referenceFor(item).replace(`>${item.candidates[0].exhibitionTime.toFixed(2)}<`, '>9.99<'), 'roster_or_exhibition_mismatch'],
  ]) test(`${item.code}: rejects ${name}`, () => {
    const result = verifySuminoeOmura(item.original, reference, item.race);
    assert.equal(result.ok, false);
    assert.equal(result.error, expected);
    assert.deepEqual(result.rows, []);
  });
}

test('production wrapper uses fixed official and national HTTPS sources', async () => {
  const saved = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      const value = String(url), code = value.includes('suminoe') || value.includes('jcd=12') ? 12 : 24;
      const item = cases.find((entry) => entry.code === code);
      calls.push(value);
      assert.equal(options.redirect, 'manual');
      const body = value.includes('boatrace.jp/owpc/pc/race/beforeinfo') ? referenceFor(item) : item.original;
      return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    };
    for (const item of cases) {
      const result = await fetchBestOriginalTenji(item.race);
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.sourceKind, 'official');
      assert.equal(result.fallbackUsed, false);
    }
    assert.equal(calls.length, 4);
    assert.ok(calls.every((url) => url.startsWith('https://')));
  } finally {
    globalThis.fetch = saved;
  }
});

test('read-only verified diagnostic allows both venues', () => {
  const code = readFileSync(new URL('../app/api/admin/verified-exhibition-check/route.js', import.meta.url), 'utf8');
  assert.ok(code.includes("validSuminoeOmuraRace(race)"));
  assert.ok(code.includes("suminoeOmuraVerifiedOriginalTenji.js"));
});
