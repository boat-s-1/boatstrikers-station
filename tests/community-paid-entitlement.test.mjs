import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVerifiedPaidEntitlement } from '../lib/community/paidEntitlement.mjs';

const now = new Date('2026-11-17T12:00:00.000Z');
const valid = { source:'verified-billing-server', status:'active', verified:true, expiresAt:'2026-12-17T12:00:00.000Z' };

test('verified, unexpired server billing entitlement passes', () => {
  assert.equal(hasVerifiedPaidEntitlement(valid,now),true);
});
test('profile defaults never unlock paid access', () => {
  assert.equal(hasVerifiedPaidEntitlement({plan:'beta_premium',membership_status:'active',beta_member:true,premium_until:'2099-01-01'},now),false);
});
test('client claims and unknown sources fail closed', () => {
  assert.equal(hasVerifiedPaidEntitlement({...valid,source:'client'},now),false);
  assert.equal(hasVerifiedPaidEntitlement({...valid,verified:'true'},now),false);
  assert.equal(hasVerifiedPaidEntitlement({...valid,status:'trialing'},now),false);
});
test('expired, boundary, malformed, and absent expiry fail closed', () => {
  assert.equal(hasVerifiedPaidEntitlement({...valid,expiresAt:now.toISOString()},now),false);
  assert.equal(hasVerifiedPaidEntitlement({...valid,expiresAt:'2020-01-01T00:00:00Z'},now),false);
  assert.equal(hasVerifiedPaidEntitlement({...valid,expiresAt:'invalid'},now),false);
  assert.equal(hasVerifiedPaidEntitlement({...valid,expiresAt:null},now),false);
  assert.equal(hasVerifiedPaidEntitlement(null,now),false);
});

test('ambiguous local-time or trailing-garbage expiry is denied', () => {
  for (const expiresAt of [
    '2026-12-17T12:00:00',
    '2026-12-17T12:00:00+09:00',
    '2026-12-17T12:00:00.000Zgarbage',
    '2026-12-17',
  ]) {
    assert.equal(hasVerifiedPaidEntitlement({...valid,expiresAt},now),false);
  }
});

test('invalid calendar dates cannot be normalized into paid access', () => {
  for (const expiresAt of [
    '2026-02-30T12:00:00.000Z',
    '2026-04-31T12:00:00Z',
    '2026-13-01T12:00:00Z',
  ]) assert.equal(hasVerifiedPaidEntitlement({...valid,expiresAt},now),false);
});
test('canonical UTC dates with optional milliseconds remain supported', () => {
  assert.equal(hasVerifiedPaidEntitlement({...valid,expiresAt:'2026-12-17T12:00:00Z'},now),true);
  assert.equal(hasVerifiedPaidEntitlement({...valid,expiresAt:'2026-12-17T12:00:00.1Z'},now),true);
});
