import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBrdbRaceDetailQuery } from './brdb-q011-query.mjs';

test('Q011 constrains meeting start and race date across month boundaries', () => {
  assert.equal(buildBrdbRaceDetailQuery('20261120'),
    "SELECT * FROM RACEDTL WHERE SOPDT >= '20261110' AND OPDT = '20261120' ORDER BY RCOURSECD, RNO, TEINO");
  assert.match(buildBrdbRaceDetailQuery('20260101'), /SOPDT >= '20251222' AND OPDT = '20260101'/);
  assert.match(buildBrdbRaceDetailQuery('20240301'), /SOPDT >= '20240220'/);
});

test('rejects malformed dates rather than interpolating arbitrary SQL', () => {
  for (const date of ['20260230', '20261301', "20261120' OR 1=1", '2026-11-20', '']) {
    assert.throws(() => buildBrdbRaceDetailQuery(date));
  }
});
