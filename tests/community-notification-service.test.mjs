import test from 'node:test';
import assert from 'node:assert/strict';
import { listNotificationsForVerifiedIdentity, markNotificationReadForVerifiedIdentity } from '../lib/community/notificationService.mjs';

const userId='123e4567-e89b-42d3-a456-426614174000';
const identity={userId,verifiedByAuthServer:true};
const profile={user_id:userId,verifiedByTrustedServer:true,membership_status:'active',withdrawn_at:null};
const row={id:'notif_1',recipient_user_id:userId,type:'service_notice',created_at:'2026-11-17T12:00:00Z',read_at:null,deleted_at:null,authorized_by_server:true,secret:'do-not-return'};
const deps={
 fetchProfile:async()=>profile,
 fetchInbox:async()=>[row,{...row,id:'other',recipient_user_id:'other-user'}],
 fetchNotification:async()=>row,
 markRead:async()=>true,
};
test('authorized list returns sanitized own rows only',async()=>{
 const result=await listNotificationsForVerifiedIdentity(identity,deps);
 assert.equal(result.ok,true);
 assert.deepEqual(result.items,[{id:'notif_1',type:'service_notice',created_at:'2026-11-17T12:00:00Z',read_at:null}]);
});
test('unverified identity does not access dependencies',async()=>{
 let called=false;
 const result=await listNotificationsForVerifiedIdentity({userId,verifiedByAuthServer:false},{fetchProfile:async()=>{called=true;},fetchInbox:async()=>[]});
 assert.equal(result.ok,false);
 assert.equal(called,false);
});
test('withdrawn or untrusted profile denies list',async()=>{
 for(const bad of [{...profile,withdrawn_at:'2026-11-17T00:00:00Z'},{...profile,verifiedByTrustedServer:false}]) {
  const result=await listNotificationsForVerifiedIdentity(identity,{...deps,fetchProfile:async()=>bad});
  assert.equal(result.ok,false);
 }
});
test('read mutation requires ownership and server authorization',async()=>{
 let updates=0;
 const good={...deps,markRead:async()=>{updates++;return true;}};
 assert.deepEqual(await markNotificationReadForVerifiedIdentity(identity,'notif_1',good),{ok:true});
 assert.equal(updates,1);
 const wrong={...good,fetchNotification:async()=>({...row,recipient_user_id:'someone-else'})};
 assert.equal((await markNotificationReadForVerifiedIdentity(identity,'notif_1',wrong)).ok,false);
 assert.equal(updates,1);
 assert.equal((await markNotificationReadForVerifiedIdentity(identity,'../bad',good)).ok,false);
 assert.equal(updates,1);
});
test('backend errors fail closed and do not leak exception text',async()=>{
 const result=await listNotificationsForVerifiedIdentity(identity,{...deps,fetchInbox:async()=>{throw Error('secret credential');}});
 assert.deepEqual(result,{ok:false,reason:'unavailable',items:[]});
});
