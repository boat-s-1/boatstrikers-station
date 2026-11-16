// Disposable CI-only PostgREST integration tests. No production URLs or keys.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import * as baseline from '../../lib/dataLabSocialClaim.js';
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
console.log('S02 candidate integration PASS: 5 scenarios; baseline and candidate compared');
