import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifyTamagawa} from '../lib/tamagawaVerifiedTenji.js';
import {fetchBestOriginalTenji} from '../lib/verifiedOriginalTenjiSource.js';
const original=fs.readFileSync(new URL('./fixtures/original-tenji/tamagawa-identity-20260828.html',import.meta.url),'utf8');
const reference=fs.readFileSync(new URL('./fixtures/original-tenji/tamagawa-reference-20260828.html',import.meta.url),'utf8');
const race={courseCode:5,raceDate:'2026-08-28',raceNo:10};
test('two actual official responses: six boat/racer/exhibition matches',()=>{const r=verifyTamagawa(original,reference,race);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.rows.length,6);assert.deepEqual(r.rows[0],{boatNo:1,racerNo:'5280',exhibitionTime:6.82,lapTime:36.98,turnTime:5.66,straightTime:7.07});});
for(const [name,o,r,expected] of [
 ['wrong reference date',original,reference.replaceAll('hd=20260828','hd=20260827'),'reference_identity_mismatch'],
 ['wrong reference venue',original,reference.replaceAll('jcd=05','jcd=14'),'reference_identity_mismatch'],
 ['wrong reference race',original,reference.replaceAll('rno=10','rno=11'),'reference_identity_mismatch'],
 ['wrong selected date',original,reference.replace('8月28日','8月29日'),'reference_date_mismatch'],
 ['wrong original race',original.replace('.html("10R")','.html("11R")'),reference,'original_race_mismatch'],
 ['wrong racer',original.replaceAll('toban=5280','toban=5281'),reference,'roster_or_exhibition_mismatch'],
 ['wrong exhibition',original.replace('6.82','6.81'),reference,'roster_or_exhibition_mismatch'],
 ['missing reference exhibition',original,reference.replace('>6.82<','>--.--<'),'roster_or_exhibition_mismatch'],
 ['missing lap',original.replace('36.98','--.--'),reference,'measurements_incomplete_or_invalid'],
 ['half lap',original.replace('一周','半周'),reference,'timing_layout_changed'],
 ['boat mismatch',original.replace('tei_color1','tei_color2'),reference,'original_boat_identity_invalid'],
 ['reference boat mismatch',original,reference.replace('is-boatColor1','is-boatColor2'),'reference_boat_identity_invalid'],
])test(`reject ${name}`,()=>{const result=verifyTamagawa(o,r,race);assert.equal(result.ok,false);assert.equal(result.error,expected);assert.deepEqual(result.rows,[]);});
test('production wrapper fetches both fixed sources; rejects mismatch without legacy fallback',async()=>{
 const saved=globalThis.fetch;let calls=0;
 try{
 globalThis.fetch=async(url,opts)=>{calls++;assert.equal(opts.redirect,'manual');return new Response(url.includes('boatrace.jp/')?reference:original);};
 const bad=await fetchBestOriginalTenji({...race,raceNo:11});assert.equal(bad.ok,false);assert.equal(calls,2);
 const good=await fetchBestOriginalTenji(race);assert.equal(good.ok,true);assert.equal(good.identity.verified,true);assert.equal(calls,4);
 good.rows[0].lapTime=0;assert.equal((await fetchBestOriginalTenji(race)).rows[0].lapTime,36.98);assert.equal(calls,4);
 }finally{globalThis.fetch=saved;}
});
