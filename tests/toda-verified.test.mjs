import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTodaOriginal, verifyToda, fetchTodaVerifiedOriginalTenji } from '../lib/todaVerifiedOriginalTenji.js';
import { fetchBestOriginalTenji } from '../lib/verifiedOriginalTenjiSource.js';

const ids = ['5007','3107','4100','4792','5235','4368'];
const times = [
  [6.78,37.12,5.31,7.62],[6.81,37.43,5.44,7.70],[6.76,36.98,5.22,7.59],
  [6.83,37.55,5.50,7.74],[6.79,37.20,5.36,7.65],[6.80,37.31,5.39,7.68],
];
const race = { courseCode:2, raceDate:'2026-09-02', raceNo:1 };

const roster = () => `<table><jcd>02</jcd>${ids.map((id,index)=>`<record><teiban>${index+1}</teiban><toban>${id}</toban></record>`).join('')}</table>`;
const original = () => `<table>${times.map(([e,l,t,s],index)=>`<record><teiban>${index+1}</teiban><ttime>${e.toFixed(2)}</ttime><rnd>${l.toFixed(2)}</rnd><cnr>${t.toFixed(2)}</cnr><str>${s.toFixed(2)}</str></record>`).join('')}</table>`;

function reference() {
  let html = readFileSync(new URL('./fixtures/original-tenji/tamagawa-reference-20260828.html', import.meta.url), 'utf8')
    .replaceAll('jcd=05', 'jcd=02').replaceAll('hd=20260828', 'hd=20260902')
    .replace('text_place2_05.png', 'text_place2_02.png').replace('<span class="tab2_inner">8月28日', '<span class="tab2_inner">9月2日')
    .replace('rno=10&amp;', 'rno=1&amp;');
  const oldIds = ['5280','4630','3805','5066','4930','4631'];
  const oldTimes = ['6.82','6.80','6.72','6.70','6.72','6.82'];
  ids.forEach((id,index) => {
    html = html.replaceAll(`toban=${oldIds[index]}`, `toban=${id}`).replaceAll(`/racerphoto/${oldIds[index]}.jpg`, `/racerphoto/${id}.jpg`)
      .replace(`<td rowspan="4">${oldTimes[index]}</td>`, `<td rowspan="4">${times[index][0].toFixed(2)}</td>`);
  });
  return html;
}

test('Toda parses and verifies XML roster plus all four metrics', () => {
  const parsed = parseTodaOriginal(original(), roster(), race);
  assert.equal(parsed.ok, true); assert.equal(parsed.rows.length, 6);
  assert.deepEqual(parsed.rows[0], {boatNo:1,racerNo:'5007',exhibitionTime:6.78,lapTime:37.12,turnTime:5.31,straightTime:7.62});
  const verified = verifyToda(original(), roster(), reference(), race);
  assert.equal(verified.ok, true); assert.equal(verified.identity.verified, true);
  assert.deepEqual(verified.eligibleTheories, {ichika:true,hatsune:true,kiina:true});
});

test('Toda fails closed for wrong venue, blanks, five boats, or national mismatch', () => {
  assert.equal(parseTodaOriginal(original(), roster().replace('<jcd>02</jcd>','<jcd>03</jcd>'), race).error, 'source_venue_mismatch');
  assert.equal(parseTodaOriginal(original().replace('<rnd>37.12</rnd>','<rnd></rnd>'), roster(), race).error, 'measurements_incomplete_or_invalid');
  assert.equal(parseTodaOriginal(original().replace(/<record><teiban>6<\/teiban>[\s\S]*?<\/record>/, ''), roster(), race).error, 'six_unique_boats_required');
  assert.equal(verifyToda(original(), roster(), reference().replace('toban=5007','toban=9999'), race).ok, false);
});

test('Toda verified route uses fixed date and race XML plus national HTTPS URL', async () => {
  const previous = global.fetch, seen = [];
  global.fetch = async (url) => {
    seen.push(String(url));
    const body = String(url).includes('boatrace.jp/owpc/') ? reference() : String(url).includes('race_table_original_') ? original() : roster();
    return new Response(body, {status:200});
  };
  try {
    assert.equal((await fetchTodaVerifiedOriginalTenji(race)).ok, true);
    assert.equal((await fetchBestOriginalTenji(race)).sourceKind, 'official');
    assert.ok(seen.some(url=>url.endsWith('/xml/kaisai/20260902/race_table_original_01.xml')));
    assert.ok(seen.some(url=>url.endsWith('/xml/kaisai/20260902/race_table_01.xml')));
    assert.ok(seen.every(url=>url.startsWith('https://')));
  } finally { global.fetch = previous; }
});
