import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationPayload,releaseTime} from '../../lib/blog/publicationRequest.mjs';
test('schedule carries an explicit timestamp through the same API contract; immediate publication is explicit null',()=>{
  const now=Date.parse('2026-10-04T00:00:00Z');
  assert.equal(releaseTime(publicationPayload(2,'schedule','2026-10-05T12:00:00+09:00',now)),'2026-10-05T03:00:00.000Z');
  assert.equal(releaseTime(publicationPayload(2,'publish')),null);
  assert.deepEqual(publicationPayload(2,'unpublish'),{version:2,action:'unpublish'});
  for(const at of ['', 'bad','2026-10-03T00:00:00Z']) assert.throws(()=>publicationPayload(2,'schedule',at,now));
});
test('missing or camelCase publication time is rejected instead of immediately publishing',()=>{
  for(const body of [{version:2},{version:2,publishAt:'2026-10-05T00:00:00Z'},{publish_at:undefined},{publish_at:42}])assert.throws(()=>releaseTime(body),e=>e.status===400);
});
