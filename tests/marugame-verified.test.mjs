import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMarugameVerifiedOriginalTenji as parse, fetchMarugameVerifiedOriginalTenji as fetchOfficial } from '../lib/marugameVerifiedOriginalTenji.js';
import { fetchBestOriginalTenji } from '../lib/verifiedOriginalTenjiSource.js';
const html = fs.readFileSync(new URL('./fixtures/original-tenji/marugame-20260828.html',import.meta.url),'utf8');
const race = {courseCode:15,raceDate:'2026-08-28',raceNo:4};
test('real six-boat fixture: identity and exact four-column values',()=>{
  const result=parse(html,race);
  assert.equal(result.ok,true);
  assert.equal(result.identity.verified,true);
  assert.deepEqual(result.rows[0],{boatNo:1,exhibitionTime:6.72,lapTime:37.60,turnTime:5.63,straightTime:5.97});
  assert.deepEqual(result.rows.map(r=>r.boatNo),[1,2,3,4,5,6]);
  assert.equal(result.rows[5].lapTime,38.47);
});
for(const [name,modified,expected] of [
  ['old date',html.replace('raceDate=20260828','raceDate=20260827'),'source_identity_mismatch'],
  ['wrong race',html.replace('raceNumber=4','raceNumber=5'),'source_identity_mismatch'],
  ['wrong venue',html.replace('15marugame','12suminoe'),'source_identity_mismatch'],
  ['missing proof',html.replace(/<iframe[\s\S]*$/,''),'source_identity_missing'],
  ['half lap',html.replace('一周','半周'),'timing_layout_changed'],
  ['boat mismatch',html.replace('rowspan="2">1','rowspan="2">2'),'boat_identity_mismatch'],
  ['missing value',html.replace('6.72','--.--'),'measurements_incomplete_or_invalid'],
  ['zero value',html.replace('6.72','0.00'),'measurements_incomplete_or_invalid'],
  ['duplicate table',html+html,'timing_table_ambiguous'],
])test(`reject ${name}`,()=>{const r=parse(modified,race);assert.equal(r.ok,false);assert.equal(r.error,expected);assert.deepEqual(r.rows,[]);});
test('impossible date and fractional race rejected',()=>{
 assert.equal(parse(html,{...race,raceDate:'2026-02-30'}).error,'invalid_race');
 assert.equal(parse(html,{...race,raceNo:4.5}).error,'invalid_race');
});
test('common production path: fail closed before fallback, then verified source',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async(url,options)=>{calls++;assert.match(url,/www.marugameboat.jp/);assert.equal(options.redirect,'manual');return new Response(html);};
  const bad=await fetchBestOriginalTenji({...race,raceDate:'2026-08-27'});
  assert.equal(bad.ok,false);assert.equal(calls,1);
  const good=await fetchBestOriginalTenji(race);
  assert.equal(good.ok,true);assert.equal(good.source,'marugame_official_verified');assert.equal(calls,2);
  good.rows[0].lapTime=99;
  assert.equal((await fetchBestOriginalTenji(race)).rows[0].lapTime,37.6);
  assert.equal(calls,2);
 }finally{globalThis.fetch=original;}
});
test('upstream redirect rejected without following',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/'}});
 const r=await fetchOfficial({...race,raceNo:5});assert.equal(r.ok,false);assert.equal(r.status,302);
 }finally{globalThis.fetch=original;}
});
