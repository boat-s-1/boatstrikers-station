// Disposable CI-only PostgREST integration tests. No production URLs or keys.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import * as baseline from './dataLabSocialClaim.baseline.mjs';
import * as candidate from './dataLabSocialClaim.candidate.mjs';

const base = 'http://127.0.0.1:3000';
const secret = 'pr297-local-only-jwt-secret-at-least-32-characters';
const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const header = b64({ alg: 'HS256', typ: 'JWT' });
const body = header + '.' + b64({ role: 'pr297_api', exp: Math.floor(Date.now()/1000)+3600 });
const jwt = body + '.' + createHmac('sha256',secret).update(body).digest('base64url');
const localFetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.origin !== base || !url.pathname.startsWith('/rest/v1/')) {
    throw new Error('Blocked nonlocal request: '+url.origin+url.pathname);
  }
  url.pathname = url.pathname.slice('/rest/v1'.length);
  return fetch(url, init);
};
const db = createClient(base, jwt, {
  auth: { persistSession:false, autoRefreshToken:false },
  global: { fetch:localFetch }
});
const table = baseline.DATA_LAB_TABLE;
async function row(date) {
  const {data,error}=await db.from(table).select('id,race_date,status,x_post_text,updated_at').eq('race_date',date).maybeSingle();
  if(error) throw error;
  return data;
}
async function seed(date, status, ageMs, text=null) {
  const updated_at = new Date(Date.now()-ageMs).toISOString();
  const {error}=await db.from(table).insert({race_date:date,status,updated_at,x_post_text:text});
  if(error) throw error;
}
async function expectFailure(fn,pattern) { await assert.rejects(fn,pattern); }

console.log('S02 candidate integration: baseline empty-draft reproduction');
const d1='2026-11-20';
await seed(d1,'generating',600000);
await expectFailure(baseline.withDataLabClaim(db,d1,{},async()=>{throw new Error('build failed')}),/build failed/);
assert.equal((await row(d1)).status,'draft','baseline issue must be reproduced');

console.log('S02 candidate integration: failed stale takeover remains generating');
const d2='2026-11-21';
await seed(d2,'generating',600000);
await expectFailure(candidate.withDataLabClaim(db,d2,{},async()=>{throw new Error('build failed')}),/build failed/);
assert.equal((await row(d2)).status,'generating','candidate must avoid empty draft');
assert.equal((await row(d2)).x_post_text,null);
assert.equal((await candidate.claimDataLabGeneration(db,d2)).reason,'busy','retry must respect 5min lease');

console.log('S02 candidate integration: lost cleanup lease is reported');
const d3='2026-11-22';
const claim=await candidate.claimDataLabGeneration(db,d3);
assert.equal(claim.ok,true);
const {error:err}=await db.from(table).update({updated_at:new Date(Date.now()+10000).toISOString()}).eq('id',claim.id);
if(err)throw err;
await expectFailure(candidate.releaseDataLabClaim(db,claim),/lease cleanup lost/);

console.log('S02 candidate integration: failed new claim deletes placeholder');
const d4='2026-11-23';
await expectFailure(candidate.withDataLabClaim(db,d4,{},async()=>{throw new Error('build failed')}),/build failed/);
assert.equal(await row(d4),null);

console.log('S02 candidate integration: successful draft is retained');
const d5='2026-11-24';
const saved=await candidate.withDataLabClaim(db,d5,{},async()=>({x_post_text:'real PostgREST candidate draft',updated_at:new Date().toISOString()}));
assert.equal(saved.ok,true);
assert.equal((await row(d5)).status,'draft');
assert.equal((await row(d5)).x_post_text,'real PostgREST candidate draft');
assert.equal((await candidate.claimDataLabGeneration(db,d5)).reason,'exists');
console.log('S02 candidate integration: 12 concurrent contenders on one empty date');
const d6='2026-11-25';
const contenders=await Promise.all(Array.from({length:12},()=>candidate.claimDataLabGeneration(db,d6)));
assert.equal(contenders.filter(x=>x.ok).length,1,'exactly one concurrent contender must win');
assert.equal(contenders.filter(x=>!x.ok && x.reason==='busy').length,11,'all losers must report busy');
await candidate.releaseDataLabClaim(db,contenders.find(x=>x.ok));
assert.equal(await row(d6),null,'winning new lease must be removable');

console.log('S02 candidate integration: stale writer cannot overwrite new owner');
const d7='2026-11-26';
await seed(d7,'generating',600000);
const newOwner=await candidate.claimDataLabGeneration(db,d7);
assert.equal(newOwner.ok,true);
const priorLease={...newOwner,updatedAt:new Date(Date.now()-600000).toISOString()};
await expectFailure(candidate.saveDataLabClaim(db,priorLease,{x_post_text:'stale overwrite'}),/lease lost/);
await expectFailure(candidate.releaseDataLabClaim(db,priorLease),/lease cleanup lost/);
assert.equal((await row(d7)).status,'generating','prior owner cannot alter current lease');
await candidate.releaseDataLabClaim(db,newOwner);

console.log('S02 candidate integration: AggregateError preserves build and cleanup errors');
const d8='2026-11-27';
let caught;
try {
  await candidate.withDataLabClaim(db,d8,{},async()=>{
    const existing=await row(d8);
    const {error}=await db.from(table).update({updated_at:new Date(Date.now()+10000).toISOString()}).eq('id',existing.id);
    if(error)throw error;
    throw new Error('original build failure');
  });
} catch(e) { caught=e; }
assert.ok(caught instanceof AggregateError,'both failures must be aggregated');
assert.equal(caught.errors.length,2);
assert.match(caught.errors[0].message,/original build failure/);
assert.match(caught.errors[1].message,/lease cleanup lost/);

console.log('S02 candidate integration: old draft with allowDraft is reclaimable');
const d9='2026-11-28';
await seed(d9,'draft',120000,'old content');
const draftClaim=await candidate.claimDataLabGeneration(db,d9,{allowDraft:true});
assert.equal(draftClaim.ok,true);
await candidate.releaseDataLabClaim(db,draftClaim);
assert.equal((await row(d9)).status,'draft');
assert.equal((await row(d9)).x_post_text,'old content');

console.log('S02 candidate integration PASS: 9 scenarios; baseline and candidate compared');
