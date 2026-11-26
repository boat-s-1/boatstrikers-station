import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBrdbRaceDetailQuery, buildBrdbRaceMasterQuery, buildBrdbSingleRaceQueries } from './brdb-q011-query.mjs';

test('Q011 constrains meeting start and race date across month boundaries', () => {
  assert.equal(buildBrdbRaceDetailQuery('20261120'),
    "SELECT * FROM RACEDTL WHERE SOPDT >= '20261110' AND OPDT = '20261120' ORDER BY RCOURSECD, RNO, TEINO");
  assert.match(buildBrdbRaceDetailQuery('20260101'), /SOPDT >= '20251222' AND OPDT = '20260101'/);
  assert.match(buildBrdbRaceDetailQuery('20240301'), /SOPDT >= '20240220'/);
});

test('rejects malformed dates rather than interpolating arbitrary SQL', () => {
  for (const date of ['20260230', '20261301', "20261120' OR 1=1", '2026-11-20', '']) {
    assert.throws(() => buildBrdbRaceDetailQuery(date));
    assert.throws(() => buildBrdbRaceMasterQuery(date));
  }
});

test('RACEMST uses the provider-recommended meeting and race date bounds', () => {
  assert.equal(buildBrdbRaceMasterQuery('20261120'),
    "SELECT * FROM RACEMST WHERE SOPDT >= '20261110' AND OPDT = '20261120' ORDER BY RCOURSECD, RNO");
  assert.match(buildBrdbRaceMasterQuery('20260101'), /SOPDT >= '20251222' AND OPDT = '20260101'/);
});

test('one-race private trial bounds both tables and selects only needed columns', () => {
  const q = buildBrdbSingleRaceQueries('20261127', 5, 2);
  assert.equal(q.master, "SELECT SOPDT, OPDT, RCOURSECD, RNO, CLOSETM, PRGF FROM RACEMST WHERE SOPDT >= '20261117' AND OPDT = '20261127' AND RCOURSECD = 5 AND RNO = 2 ORDER BY RCOURSECD, RNO");
  assert.equal(q.detail, "SELECT SOPDT, OPDT, RCOURSECD, RNO, TEINO, ENTNO FROM RACEDTL WHERE SOPDT >= '20261117' AND OPDT = '20261127' AND RCOURSECD = 5 AND RNO = 2 ORDER BY RCOURSECD, RNO, TEINO");
  for (const args of [['20261127', 0, 2], ['20261127', 5, 13], ["20261127' OR 1=1", 5, 2], ['20260230', 5, 2]]) {
    assert.throws(() => buildBrdbSingleRaceQueries(...args));
  }
});
