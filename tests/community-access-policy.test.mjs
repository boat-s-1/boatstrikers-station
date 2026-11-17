import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadAudience, canReply, isPublicAudience } from '../lib/community/accessPolicy.mjs';

test('public posts readable by everyone', () => {
  for (const level of ['guest','free','paid']) assert.equal(canReadAudience('public',level),true);
});
test('members-only posts reject guests', () => {
  assert.equal(canReadAudience('members','guest'),false);
  assert.equal(canReadAudience('members','free'),true);
  assert.equal(canReadAudience('members','paid'),true);
});
test('paid posts require paid role', () => {
  assert.equal(canReadAudience('paid','guest'),false);
  assert.equal(canReadAudience('paid','free'),false);
  assert.equal(canReadAudience('paid','paid'),true);
});
test('fail closed on unknown roles and audiences', () => {
  assert.equal(canReadAudience('invalid','paid'),false);
  assert.equal(canReadAudience('public','admin'),false);
});
test('replies paid-only and lock overrides', () => {
  assert.equal(canReply({audience:'public'},'free'),false);
  assert.equal(canReply({audience:'public'},'paid'),true);
  assert.equal(canReply({audience:'members'},'paid'),true);
  assert.equal(canReply({audience:'paid'},'paid'),true);
  assert.equal(canReply({audience:'public',locked:true},'paid'),false);
  assert.equal(canReply({audience:'public',replyPolicy:'disabled'},'paid'),false);
});
test('public search visibility excludes member-only', () => {
  assert.equal(isPublicAudience('public'),true);
  assert.equal(isPublicAudience('members'),false);
  assert.equal(isPublicAudience('paid'),false);
});
