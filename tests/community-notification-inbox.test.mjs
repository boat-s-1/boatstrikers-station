import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleInboxItems, canMarkInboxItemRead, normalizeInboxPageSize } from '../lib/community/notificationInbox.mjs';

const base={ id:'n1', recipient_user_id:'u1', type:'thread_reply', created_at:'2026-11-17T01:00:00Z', read_at:null, deleted_at:null, authorized_by_server:true, can_recipient_read_thread:true };
test('only own authorized readable inbox rows are visible',()=>{
 const items=[base,{...base,id:'other',recipient_user_id:'u2'},{...base,id:'hidden',can_recipient_read_thread:false},{...base,id:'deleted',deleted_at:'2026-11-17T02:00:00Z'},{...base,id:'unverified',authorized_by_server:false}];
 assert.deepEqual(visibleInboxItems(items,'u1').map(x=>x.id),['n1']);
});
test('prediction visibility and unknown event types fail closed',()=>{
 assert.deepEqual(visibleInboxItems([{...base,id:'p',type:'prediction_published',can_recipient_read_prediction:false},{...base,id:'x',type:'__proto__'}],'u1'),[]);
 assert.equal(visibleInboxItems([{...base,id:'p',type:'prediction_published',can_recipient_read_prediction:true}],'u1').length,1);
});
test('newest first, bounded page size, invalid dates rejected',()=>{
 const items=[base,{...base,id:'n2',created_at:'2026-11-17T02:00:00Z'},{...base,id:'bad',created_at:'not a date'}];
 assert.deepEqual(visibleInboxItems(items,'u1',{limit:1}).map(x=>x.id),['n2']);
 assert.equal(normalizeInboxPageSize(1000),50);
 assert.equal(normalizeInboxPageSize(-1),20);
});
test('read marking only permitted for own active server-authorized item',()=>{
 assert.equal(canMarkInboxItemRead(base,'u1'),true);
 assert.equal(canMarkInboxItemRead(base,'u2'),false);
 assert.equal(canMarkInboxItemRead({...base,authorized_by_server:false},'u1'),false);
 assert.equal(canMarkInboxItemRead({...base,deleted_at:'2026-11-17T02:00:00Z'},'u1'),false);
 assert.equal(canMarkInboxItemRead(null,'u1'),false);
});
