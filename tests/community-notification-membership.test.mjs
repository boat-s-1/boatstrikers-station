import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedNotificationMembership } from '../lib/community/notificationMembership.mjs';
import { verifiedNotificationPrincipal } from '../lib/community/notificationPrincipal.mjs';

const id='123e4567-e89b-42d3-a456-426614174000';
const identity={userId:id,verifiedByAuthServer:true};
const profile={user_id:id,verifiedByTrustedServer:true,membership_status:'active',withdrawn_at:null,plan:'free'};
test('verified Auth plus trusted active profile yields a principal',()=>{
 const result=verifiedNotificationMembership(identity,profile);
 assert.equal(result.userId,id);
 assert.deepEqual(verifiedNotificationPrincipal(result),{userId:id});
});
test('denies spoofed identity, mismatched member, inactive or withdrawn',()=>{
 assert.equal(verifiedNotificationMembership({...identity,verifiedByAuthServer:false},profile),null);
 assert.equal(verifiedNotificationMembership(identity,{...profile,verifiedByTrustedServer:false}),null);
 assert.equal(verifiedNotificationMembership(identity,{...profile,user_id:'123e4567-e89b-42d3-a456-426614174001'}),null);
 assert.equal(verifiedNotificationMembership(identity,{...profile,membership_status:'suspended'}),null);
 assert.equal(verifiedNotificationMembership(identity,{...profile,withdrawn_at:'2026-11-17T00:00:00Z'}),null);
 assert.equal(verifiedNotificationMembership(null,profile),null);
});
test('editable plan, beta and admin claims never elevate notification access',()=>{
 const result=verifiedNotificationMembership(identity,{...profile,plan:'premium',beta_member:true,is_admin:true});
 assert.equal(Object.hasOwn(result,'plan'),false);
 assert.equal(Object.hasOwn(result,'is_admin'),false);
 assert.equal(Object.hasOwn(result,'beta_member'),false);
});
