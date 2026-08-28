import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseNarutoKaratsu} from '../lib/narutoKaratsuVerifiedTenji.js';
import {parseMarugameVerifiedOriginalTenji} from '../lib/marugameVerifiedOriginalTenji.js';
import {verifyTamagawa} from '../lib/tamagawaVerifiedTenji.js';
import {parseHistoricalOriginalTenji} from '../lib/historicalOriginalTenji.js';

const fixture=name=>readFileSync(new URL(`./fixtures/original-tenji/${name}.html`,import.meta.url),'utf8');
const now=new Date('2026-08-28T06:00:00Z');
const cases=[
 ['tamagawa-identity-20260828',5,'2026-08-28',10,(h,r)=>verifyTamagawa(h,fixture('tamagawa-reference-20260828'),r)],
 ['naruto-identity-20260828',14,'2026-08-28',10,(h,r)=>parseNarutoKaratsu(h,r,now)],
 ['karatsu-identity-20260828',23,'2026-08-28',10,(h,r)=>parseNarutoKaratsu(h,r,now)],
 ['marugame-20260828',15,'2026-08-28',4,parseMarugameVerifiedOriginalTenji],
 ['suminoe-20260818',12,'2026-08-18',10,parseHistoricalOriginalTenji],
 ['tokuyama-20260815',18,'2026-08-15',10,parseHistoricalOriginalTenji],
 ['omura-20260717',24,'2026-07-17',3,parseHistoricalOriginalTenji],
];
const entries=r=>r.candidateRows||r.rows;
const rejected=r=>{assert.equal(r.ok,false);assert.deepEqual(r.rows,[]);if(r.candidateRows)assert.deepEqual(r.candidateRows,[]);};
for(const [name,courseCode,raceDate,raceNo,parse] of cases){
 const html=fixture(name),race={courseCode,raceDate,raceNo};
 const baseline=parse(html,race);
 test(`${name}: baseline has six entries`,()=>{assert.equal(baseline.ok,true);assert.equal(entries(baseline).length,6);});
 for(const missing of ['', '--.--', '欠場', '欠測', '0.00']){
  test(`${name}: missing/cancelled lap (${missing||'blank'}) returns no usable rows`,()=>{
   const value=entries(baseline)[0].lapTime.toFixed(2),changed=html.replace(value,missing);
   assert.notEqual(changed,html);rejected(parse(changed,race));
  });
 }
 test(`${name}: half-lap label is not accepted as full lap`,()=>rejected(parse(html.replaceAll('一周','半周'),race)));
 test(`${name}: yesterday page cannot satisfy next-day request`,()=>{
  const next=new Date(`${raceDate}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
  rejected(parse(html,{...race,raceDate:next.toISOString().slice(0,10)}));
 });
 // Select complete timing-entry blocks, preserving each explicit boat/course identity.
 const pattern=courseCode===15?/<tr class="line_waku0[1-6]">[\s\S]*?<\/tr>\s*<tr class="line_waku0[1-6]">[\s\S]*?<\/tr>/g:courseCode===18?/<div><span><a\b[\s\S]*?<\/div>/g:
  courseCode===24?/<td\b[^>]*rowspan=['"]2['"][^>]*>[1-6]<\/td>\s*<td\b[^>]*colspan=['"]7['"][^>]*>[\s\S]*?<\/td>\s*<tr\b[^>]*>[\s\S]*?<\/tr>/g:
  /<tr\b[^>]*>(?:(?!<\/tr>)[\s\S])*?(?:tei_color[1-6]|waku0[1-6])(?:(?!<\/tr>)[\s\S])*?<\/tr>/g;
 const blocks=[...html.matchAll(pattern)].map(m=>m[0]);
 test(`${name}: fixture transformation selects exactly six timing entries`,()=>assert.equal(blocks.length,6));
 test(`${name}: five boats/course entries rejected`,()=>{assert.equal(blocks.length,6);rejected(parse(html.replace(blocks[5],''),race));});
 test(`${name}: reordered entries retain their own measurements`,()=>{
  assert.equal(blocks.length,6);let i=0;const changed=html.replace(pattern,()=>blocks[5-i++]);
  const result=parse(changed,race);assert.equal(result.ok,true,JSON.stringify(result));
  const key=courseCode===24?'exhibitionCourse':'boatNo';
  const sorted=rows=>[...rows].sort((a,b)=>a[key]-b[key]);
  assert.deepEqual(sorted(entries(result)),sorted(entries(baseline)));
  if(courseCode===24)assert.ok(entries(result).every(r=>r.boatNo===null));
 });
}
test('Karatsu: page switched to tomorrow before JST midnight rejected',()=>{
 const html=fixture('karatsu-identity-20260828').replaceAll('2026/08/28','2026/08/29');
 rejected(parseNarutoKaratsu(html,{courseCode:23,raceDate:'2026-08-28',raceNo:10},now));
});
test('Karatsu: yesterday page rejected immediately after JST midnight',()=>{
 rejected(parseNarutoKaratsu(fixture('karatsu-identity-20260828'),{courseCode:23,raceDate:'2026-08-28',raceNo:10},new Date('2026-08-28T15:00:00Z')));
});
