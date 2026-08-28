import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHistoricalOriginalTenji as parse, validHistoricalRace} from '../lib/historicalOriginalTenji.js';

const samples = [
 {name:'tokuyama-20260815',courseCode:18,raceDate:'2026-08-15',raceNo:10,first:[7,37.7,11.72,null]},
 {name:'suminoe-20260818',courseCode:12,raceDate:'2026-08-18',raceNo:10,first:[6.87,37.49,11.56,null]},
 {name:'omura-20260717',courseCode:24,raceDate:'2026-07-17',raceNo:3,first:[7,38,6.33,7.5]},
];
for(const s of samples){
 const html=readFileSync(new URL(`./fixtures/original-tenji/${s.name}.html`,import.meta.url),'utf8');
 test(`${s.name}: real six-entry sample remains staging-only`,()=>{
  const result=parse(html,s);assert.equal(result.ok,true);assert.equal(result.candidateRows.length,6);
  const r=result.candidateRows[0];assert.deepEqual([r.exhibitionTime,r.lapTime,r.turnTime,r.straightTime],s.first);
  assert.deepEqual(result.rows,[]);assert.equal(result.notificationReady,false);assert.ok(result.blockingReasons.length);
  if(s.courseCode===24)assert.ok(result.candidateRows.every(r=>r.boatNo===null));
  else assert.ok(result.candidateRows.every(r=>r.straightTime===null));
 });
 test(`${s.name}: wrong date rejected`,()=>assert.equal(parse(html,{...s,raceDate:'2026-08-28'}).ok,false));
 test(`${s.name}: wrong race rejected`,()=>assert.equal(parse(html,{...s,raceNo:11}).ok,false));
 test(`${s.name}: missing identity rejected`,()=>assert.equal(parse(html.replace(/<iframe[\s\S]*?<\/iframe>/gi,'').replace(/<title[\s\S]*?<\/title>/gi,''),s).ok,false));
 test(`${s.name}: missing lap measurement rejected`,()=>assert.equal(parse(html.replaceAll(s.first[1].toFixed(2),'--'),s).ok,false));
 test(`${s.name}: zero measurement rejected`,()=>assert.equal(parse(html.replaceAll(s.first[0].toFixed(2),'0.00'),s).ok,false));
 test(`${s.name}: changed lap label rejected`,()=>assert.equal(parse(html.replaceAll('一周','半周'),s).ok,false));
 test(`${s.name}: duplicate entry identity rejected`,()=>{
  const changed=s.courseCode===18?html.replaceAll("href='#2'","href='#1'").replaceAll('mb_tenjidata_no2.gif','mb_tenjidata_no1.gif'):s.courseCode===12?html.replaceAll('waku02','waku01'):html.replace(/(rowspan='2'[^>]*>)2(<\/td>)/,'$11$2');
  assert.notEqual(changed,html);assert.equal(parse(changed,s).ok,false);
 });
}
test('invalid date, course and race rejected',()=>{
 for(const r of [{courseCode:18,raceDate:'2026-02-30',raceNo:1},{courseCode:1,raceDate:'2026-08-15',raceNo:1},{courseCode:18,raceDate:'2026-08-15',raceNo:1.5}])assert.equal(validHistoricalRace(r),false);
});
