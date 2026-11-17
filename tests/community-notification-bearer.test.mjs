import test from 'node:test';
import assert from 'node:assert/strict';
import { extractNotificationBearerToken } from '../lib/community/notificationBearer.mjs';

test('accepts one well-formed bearer token only',()=>{
 assert.equal(extractNotificationBearerToken('Bearer abc.def_123-xyz'),'abc.def_123-xyz');
 assert.equal(extractNotificationBearerToken('bearer abc'),'abc');
});
test('rejects missing, multiple, oversized or injected credentials',()=>{
 for (const value of [null,'','Basic abc','Bearer','Bearer ','Bearer abc def','Bearer abc\nX-Other: 1','Bearer abc, Bearer def','Bearer '+'x'.repeat(8193), 'Bearer abc;foo']) {
  assert.equal(extractNotificationBearerToken(value),null);
 }
});
