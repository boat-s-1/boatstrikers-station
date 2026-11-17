import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedNotificationPrincipal, canReadNotificationForPrincipal, canAcknowledgeNotificationForPrincipal } from '../lib/community/notificationPrincipal.mjs';

const userId='123e4567-e89b-42d3-a456-426614174000';
const session={verifiedByAuthServer:true,userId,accountStatus:'active',isAnonymous:false,withdrawn:false,blocked:false};
const row={id:'n1',recipient_user_id:userId,deleted_at:null,authorized_by_server:true};
test('requires trusted provider verification and active account',()=>{
 assert.deepEqual(verifiedNotificationPrincipal(session),{userId});
 assert.equal(verifiedNotificationPrincipal({...session,verifiedByAuthServer:false}),null);
 assert.equal(verifiedNotificationPrincipal({...session,verifiedByAuthServer:'true'}),null);
 assert.equal(verifiedNotificationPrincipal({...session,userId:'u1'}),null);
 assert.equal(verifiedNotificationPrincipal({...session,isAnonymous:true}),null);
 assert.equal(verifiedNotificationPrincipal({...session,withdrawn:true}),null);
 assert.equal(verifiedNotificationPrincipal({...session,blocked:true}),null);
 assert.equal(verifiedNotificationPrincipal({...session,accountStatus:'suspended'}),null);
});
test('only owner can read or acknowledge authorized notification',()=>{
 const principal=verifiedNotificationPrincipal(session);
 assert.equal(canReadNotificationForPrincipal(principal,row),true);
 assert.equal(canReadNotificationForPrincipal(principal,{...row,recipient_user_id:'other'}),false);
 assert.equal(canReadNotificationForPrincipal(principal,{...row,authorized_by_server:false}),false);
 assert.equal(canAcknowledgeNotificationForPrincipal(principal,row,'n1'),true);
 assert.equal(canAcknowledgeNotificationForPrincipal(principal,row,'n2'),false);
 assert.equal(canAcknowledgeNotificationForPrincipal(null,row,'n1'),false);
});
test('unverified client claims and malformed rows are denied',()=>{
 assert.equal(verifiedNotificationPrincipal({userId,accountStatus:'active'}),null);
 assert.equal(canReadNotificationForPrincipal(null,row),false);
 assert.equal(canReadNotificationForPrincipal(verifiedNotificationPrincipal(session),null),false);
});
