import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeNotificationCursor, decodeNotificationCursor, isBeforeNotificationCursor } from '../lib/community/notificationCursor.mjs';

const item = { id:'notif_123', created_at:'2026-11-17T09:00:00.000Z' };
test('cursor round trips without leaking user or private message data',()=>{
 const encoded=encodeNotificationCursor(item);
 assert.equal(encoded,'2026-11-17T09:00:00.000Z|notif_123');
 assert.deepEqual(decodeNotificationCursor(encoded),item);
});
test('rejects malformed, oversized, injected and noncanonical cursors',()=>{
 for (const value of [null,undefined,'', '2026-11-17|id', '2026-11-17T09:00:00.000Z|id|other', '2026-11-17T09:00:00.000Z|a/b', '2026-11-17T09:00:00.000Z|', '2026-02-30T09:00:00.000Z|id', 'x'.repeat(300)]) {
  assert.equal(decodeNotificationCursor(value),null);
 }
 assert.equal(encodeNotificationCursor({...item,id:'x|y'}),null);
});
test('stable chronological and tie-break pagination',()=>{
 const cursor=decodeNotificationCursor(encodeNotificationCursor(item));
 assert.equal(isBeforeNotificationCursor({...item,id:'notif_122'},cursor),true);
 assert.equal(isBeforeNotificationCursor({...item,id:'notif_124'},cursor),false);
 assert.equal(isBeforeNotificationCursor({...item,created_at:'2026-11-17T08:59:59.000Z'},cursor),true);
 assert.equal(isBeforeNotificationCursor({...item,created_at:'2026-11-17T09:00:01.000Z'},cursor),false);
 assert.equal(isBeforeNotificationCursor(item,null),false);
});
