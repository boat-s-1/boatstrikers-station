import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationAuthProbe } from '../lib/community/notificationAuthProbe.mjs';

const userId='123e4567-e89b-42d3-a456-426614174000';
const member={identity:{userId,verifiedByAuthServer:true},profile:{user_id:userId,verifiedByTrustedServer:true,membership_status:'active',withdrawn_at:null,plan:'premium',is_admin:true}};
test('valid active member returns boolean only, no PII and no caching',async()=>{
 const r=await notificationAuthProbe('Bearer abc.def',async()=>member);
 assert.equal(r.status,200);
 assert.deepEqual(r.body,{authenticated:true});
 assert.equal(r.headers['Cache-Control'],'private, no-store, max-age=0');
 assert.equal(r.headers.Vary,'Authorization');
 assert.equal(r.headers['X-Content-Type-Options'],'nosniff');
 assert.equal(r.headers['Referrer-Policy'],'no-referrer');
 assert.equal(JSON.stringify(r).includes(userId),false);
 assert.equal(JSON.stringify(r).includes('premium'),false);
});
test('missing token rejects without calling loader',async()=>{
 let called=false;
 const r=await notificationAuthProbe('Basic abc',async()=>{called=true;return member;});
 assert.equal(r.status,401);
 assert.equal(called,false);
});
test('withdrawn, mismatched, and forged members fail closed',async()=>{
 for (const m of [
  {...member,profile:{...member.profile,withdrawn_at:'2026-11-17T01:00:00Z'}},
  {...member,profile:{...member.profile,user_id:'123e4567-e89b-42d3-a456-426614174001'}},
  {...member,identity:{...member.identity,verifiedByAuthServer:false}},
  null,
 ]) {
  const r=await notificationAuthProbe('Bearer token',async()=>m);
  assert.deepEqual(r.body,{authenticated:false});
  assert.equal(r.status,401);
 }
});
test('backend failure returns generic unavailable without secrets',async()=>{
 const r=await notificationAuthProbe('Bearer token',async()=>{throw Error('private-secret');});
 assert.equal(r.status,503);
 assert.deepEqual(r.body,{available:false});
 assert.equal(JSON.stringify(r).includes('private-secret'),false);
});

test('every failure response prevents credential-specific caching',async()=>{
 for (const r of [
  await notificationAuthProbe(null,async()=>member),
  await notificationAuthProbe('Bearer token',async()=>null),
  await notificationAuthProbe('Bearer token',async()=>{throw Error('down');}),
 ]) {
  assert.equal(r.headers.Vary,'Authorization');
  assert.match(r.headers['Cache-Control'],/no-store/);
  assert.equal(r.headers['Referrer-Policy'],'no-referrer');
 }
});
