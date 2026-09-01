import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFukuokaOriginal, verifyFukuoka, fetchFukuokaVerifiedOriginalTenji } from '../lib/fukuokaVerifiedOriginalTenji.js';
import { fetchBestOriginalTenji } from '../lib/verifiedOriginalTenjiSource.js';

const ids = ['5007','3107','4100','4792','5235','4368'];
const times = [
  [6.78,37.12,5.31,7.62],[6.81,37.43,5.44,7.70],[6.76,36.98,5.22,7.59],
  [6.83,37.55,5.50,7.74],[6.79,37.20,5.36,7.65],[6.80,37.31,5.39,7.68],
];
const race = { courseCode:22, raceDate:'2026-09-02', raceNo:1 };

function original() {
  const rows = ids.map((id, index) => {
    const [e,l,t,s] = times[index];
    return `<tr><td class="col1 imp-num${index+1}">${index+1}</td><td class="col2"><li>B1/福岡</li><li>選手</li><li>${id}/福岡/30</li></td><td class="col6">${e.toFixed(2)}</td><td class="col7">${l.toFixed(2)}</td><td class="col8">${t.toFixed(2)}</td><td class="col9">${s.toFixed(2)}</td></tr>`;
  }).join('');
  return `<table class="tenji"><tr><th>艇番</th><th>展示タイム</th><th>オリジナル展示データ</th><th>一周</th><th>まわり足</th><th>直線</th></tr>${rows}</table><p>一周・まわり足・直線タイムは、BOATRACE 福岡独自計測値です。</p>`;
}

function reference() {
  let html = readFileSync(new URL('./fixtures/original-tenji/tamagawa-reference-20260828.html', import.meta.url), 'utf8')
    .replaceAll('jcd=05', 'jcd=22').replaceAll('hd=20260828', 'hd=20260902')
    .replace('text_place2_05.png', 'text_place2_22.png').replace('<span class="tab2_inner">8月28日', '<span class="tab2_inner">9月2日')
    .replace('rno=10&amp;', 'rno=1&amp;');
  const oldIds = ['5280','4630','3805','5066','4930','4631'];
  const oldTimes = ['6.82','6.80','6.72','6.70','6.72','6.82'];
  ids.forEach((id,index) => {
    html = html.replaceAll(`toban=${oldIds[index]}`, `toban=${id}`).replaceAll(`/racerphoto/${oldIds[index]}.jpg`, `/racerphoto/${id}.jpg`)
      .replace(`<td rowspan="4">${oldTimes[index]}</td>`, `<td rowspan="4">${times[index][0].toFixed(2)}</td>`);
  });
  return html;
}

test('Fukuoka parses and verifies six boats with all four metrics', () => {
  const parsed = parseFukuokaOriginal(original(), race);
  assert.equal(parsed.ok, true); assert.equal(parsed.rows.length, 6);
  assert.deepEqual(parsed.rows[0], { boatNo:1, racerNo:'5007', exhibitionTime:6.78, lapTime:37.12, turnTime:5.31, straightTime:7.62 });
  const verified = verifyFukuoka(original(), reference(), race);
  assert.equal(verified.ok, true); assert.equal(verified.identity.verified, true);
  assert.deepEqual(verified.eligibleTheories, { ichika:true, hatsune:true, kiina:true });
});

test('Fukuoka fails closed for wrong venue, blanks, five boats, or national mismatch', () => {
  assert.equal(parseFukuokaOriginal(original().replace('BOATRACE 福岡', '別会場'), race).error, 'source_venue_mismatch');
  assert.equal(parseFukuokaOriginal(original().replace('>37.12<', '><'), race).error, 'measurements_incomplete_or_invalid');
  assert.equal(parseFukuokaOriginal(original().replace(/<tr><td class="col1 imp-num6">[\s\S]*?<\/tr>/, ''), race).error, 'six_unique_boats_required');
  assert.equal(verifyFukuoka(original(), reference().replace('toban=5007', 'toban=9999'), race).ok, false);
});

test('Fukuoka verified route uses fixed official and national HTTPS URLs', async () => {
  const previous = global.fetch, seen = [];
  global.fetch = async (url) => { seen.push(String(url)); return new Response(String(url).includes('boatrace.jp/owpc/') ? reference() : original(), { status:200 }); };
  try {
    assert.equal((await fetchFukuokaVerifiedOriginalTenji(race)).ok, true);
    assert.equal((await fetchBestOriginalTenji(race)).sourceKind, 'official');
    assert.ok(seen.some((url) => url.includes('/modules/yosou/tenji_info.php?day=20260902&race=1&if=1&nowmode=1')));
    assert.ok(seen.every((url) => url.startsWith('https://')));
  } finally { global.fetch = previous; }
});
