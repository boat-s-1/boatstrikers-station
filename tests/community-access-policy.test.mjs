import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadAudience, canReply, canReplyToPublishedThread, isPublicAudience } from '../lib/community/accessPolicy.mjs';

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
  assert.equal(canReply({audience:'public',replyPolicy:'paid'},'free'),false);
  assert.equal(canReply({audience:'public',replyPolicy:'paid'},'paid'),true);
  assert.equal(canReply({audience:'members',replyPolicy:'paid'},'paid'),true);
  assert.equal(canReply({audience:'paid',replyPolicy:'paid'},'paid'),true);
  assert.equal(canReply({audience:'public',replyPolicy:'paid',locked:true},'paid'),false);
  assert.equal(canReply({audience:'public',replyPolicy:'disabled'},'paid'),false);
});
test('public search visibility excludes member-only', () => {
  assert.equal(isPublicAudience('public'),true);
  assert.equal(isPublicAudience('members'),false);
  assert.equal(isPublicAudience('paid'),false);
});

test('prototype property names are not roles or audiences', () => {
  assert.equal(canReadAudience('constructor','paid'),false);
  assert.equal(canReadAudience('public','toString'),false);
  assert.equal(canReadAudience('__proto__','paid'),false);
});

test('reply rejects null thread and ambiguous lock state', () => {
  assert.equal(canReply(null,'paid'),false);
  assert.equal(canReply(undefined,'paid'),false);
  assert.equal(canReply({audience:'public',locked:'false'},'paid'),false);
});

test('missing reply policy defaults to disabled', () => {
  assert.equal(canReply({audience:'public'},'paid'),false);
  assert.equal(canReply({audience:'public',replyPolicy:'paid'},'paid'),true);
});

test('database reply_policy accepted; conflicting alias rejected', () => {
  assert.equal(canReply({audience:'public',reply_policy:'paid'},'paid'),true);
  assert.equal(canReply({audience:'public',reply_policy:'disabled'},'paid'),false);
  assert.equal(canReply({audience:'public',reply_policy:'disabled',replyPolicy:'paid'},'paid'),false);
});

test('write-path guard rejects draft, future, invalid date and nonpaid reply', () => {
  const now = new Date('2026-11-17T12:00:00.000Z');
  const thread = {audience:'public', reply_policy:'paid', status:'published', published_at:'2026-11-16T12:00:00.000Z'};
  assert.equal(canReplyToPublishedThread(thread,'paid',now),true);
  assert.equal(canReplyToPublishedThread({...thread,status:'draft'},'paid',now),false);
  assert.equal(canReplyToPublishedThread({...thread,published_at:'2026-11-18T12:00:00.000Z'},'paid',now),false);
  assert.equal(canReplyToPublishedThread({...thread,published_at:'invalid'},'paid',now),false);
  assert.equal(canReplyToPublishedThread({...thread,published_at:null},'paid',now),false);
  assert.equal(canReplyToPublishedThread(thread,'free',now),false);
  assert.equal(canReplyToPublishedThread({...thread,locked:true},'paid',now),false);
});
