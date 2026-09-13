import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { summarizePersistedPcFallback } from '../lib/persistedExhibitionFallback.js';
import { selectExhibitionCollectionTargets } from '../lib/exhibitionCollectionTargets.js';
import { fetchTsuOfficialOriginalTenji } from '../lib/tsuOfficialOriginalTenji.js';

const nowJst = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const fixture = fs.readFileSync(new URL('./fixtures/original-tenji/tsu-20260829.html', import.meta.url), 'utf8');

function pcRows(source = 'PC-KYOTEI') {
  return Array.from({ length: 6 }, (_, index) => ({
    boat_no: index + 1,
    official_exhibition_time: 6.7 + index / 100,
    official_straight: 7.5 + index / 100,
    official_exhibition_source: source,
    official_exhibition_synced_at: '2026-09-14T03:00:00Z',
  }));
}

test('persisted PC-KYOTEI values are accepted only when six required rows are complete', () => {
  assert.deepEqual(summarizePersistedPcFallback(pcRows(), 'kiina'), {
    ok:true, source:'PC-KYOTEI', sourceKind:'pc_kyotei', rows:6,
    metrics:['exhibition','straight'], pcFields:12, error:null,
  });
  assert.equal(summarizePersistedPcFallback(pcRows().slice(0, 5), 'kiina').ok, false);
  assert.equal(summarizePersistedPcFallback(pcRows().map((row, index) => index ? row : { ...row, official_straight:null }), 'kiina').ok, false);
  assert.equal(summarizePersistedPcFallback(pcRows('tsu_official'), 'kiina').ok, false);
});

test('collection targets prioritize live races and use spare capacity for recent failed races', () => {
  const events = [
    { race_date:'2026-09-14', course_code:9, race_no:4, closing_time:'12:10:00' },
    { race_date:'2026-09-14', course_code:18, race_no:3, closing_time:'11:55:00' },
    { race_date:'2026-09-14', course_code:5, race_no:3, closing_time:'11:54:00' },
  ];
  const remaining = (_date, time) => ({ '12:10:00':10, '11:55:00':-5, '11:54:00':-6 })[time];
  const attempts = [
    { ...events[1], reason_code:'timeout', checked_at:'2026-09-14T02:55:00Z' },
    { ...events[2], reason_code:'ready', checked_at:'2026-09-14T02:54:00Z' },
  ];
  const targets = selectExhibitionCollectionTargets(events, attempts, remaining, 2);
  assert.deepEqual(targets.map((row) => [row.race_no,row.collectionPhase]), [[4,'live'],[3,'recovery']]);
  assert.equal(targets.some((row) => Number(row.course_code) === 5), false);
});

test('Tsu retries an incomplete Ajax response through the official page session', async () => {
  const day = nowJst().replaceAll('-', '');
  const identity = `<a class="selected" data-day="${day}" data-race="1" data-run="0" data-req="sttenji">`;
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url:String(url), headers:options.headers || {} });
    if (requests.length === 1) return new Response(identity, { status:200 });
    if (requests.length === 2) return new Response('<html>shell</html>', { status:200, headers:{ 'set-cookie':'PHPSESSID=tsu-test; Path=/; HttpOnly' } });
    return new Response(identity + fixture, { status:200 });
  };
  try {
    const result = await fetchTsuOfficialOriginalTenji({ raceDate:nowJst(), courseCode:9, raceNo:1 }, { timeoutMs:1000 });
    assert.equal(result.ok, true);
    assert.equal(result.rows.length, 6);
    assert.equal(requests.length, 3);
    assert.match(requests[2].headers.cookie, /PHPSESSID=tsu-test/);
    assert.deepEqual(result.attempts.map((attempt) => attempt.mode), ['direct','session_bootstrap','session_retry']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
