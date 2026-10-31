import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {verifyGamagoriProgram,loadGamagoriProgram,verifyGamagoriStatus} from './gamagori-program-safety.mjs';
const html=readFileSync(new URL('../tests/fixtures/gamagori/program-20261031-01.html',import.meta.url),'utf8');
const args={date:'2026-10-31',race:1,deadline:'15:21:00',entries:[5321,3747,3905,3696,4094,3303].map((id,i)=>({boat_no:i+1,registration:String(id).padStart(5,'0')}))};
test('actual official program confirms exact date, race, deadline and six registered racers',()=>{assert.equal(verifyGamagoriProgram(html,args).source,'gamagori_official_program');});
test('wrong day/race/postponed deadline or changed roster fail closed',()=>{for(const x of [{date:'2026-10-30'},{race:2},{deadline:'15:23:00'},{entries:args.entries.slice(0,5)},{entries:args.entries.map((x,i)=>i?x:{...x,registration:'9999'})}])assert.throws(()=>verifyGamagoriProgram(html,{...args,...x}));});
test('cancellation, withdrawal, postponement and malformed official page fail closed',()=>{for(const text of ['欠場','開催中止','順延','不成立','出走取消'])assert.throws(()=>verifyGamagoriProgram(html.replace('id="main"','id="main">'+text+'<i'),args),/cancellation/);assert.throws(()=>verifyGamagoriProgram('maintenance',args));});
test('stale or missing Date, aged cache, HTTP errors and transport failures block collection',async()=>{
 const now=Date.parse('2026-10-31T04:00:00Z'),opts={...args,deadlineAt:now+38000};
 for(const headers of [{},{date:new Date(now-180000).toUTCString()},{date:new Date(now).toUTCString(),age:'90'}])await assert.rejects(loadGamagoriProgram(opts,async()=>new Response(html,{headers}),()=>now),/stale/);
 await assert.rejects(loadGamagoriProgram(opts,async()=>new Response('',{status:429}),()=>now),/http_429/);
 await assert.rejects(loadGamagoriProgram(opts,async()=>{throw Error('network')},()=>now),/network_or_timeout/);
 await assert.rejects(loadGamagoriProgram({...opts,deadlineAt:now+1000},async()=>{throw Error('must not fetch')},()=>now),/time_budget/);
});
test('fresh program plus dated schedule is not a proven live sale state',async()=>{
 const now=Date.parse('2026-10-31T04:00:00Z');let calls=0;
 const index=readFileSync(new URL('../tests/fixtures/gamagori/official-index-20261031.html',import.meta.url),'utf8');
 await assert.rejects(loadGamagoriProgram({...args,deadlineAt:now+38000},async(url,options)=>{calls++;assert(url.startsWith('https://www.gamagori-kyotei.com/'));assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');return new Response(url.includes('/index/')?index:html,{headers:{date:new Date(now).toUTCString(),age:'0'}})},()=>now,async()=>{}),/status_unknown/);
 assert.equal(calls,2);
});
test('empty status or ambiguous information never proves no cancellation',()=>{
 for(const text of ['', 'function funcTicker() {}','お知らせ','前日のレース'])assert.throws(()=>verifyGamagoriStatus(text),/status_unknown/);
 for(const text of ['本日開催中。ただし9Rは中止','発売中/欠場あり','順延'])assert.throws(()=>verifyGamagoriStatus(text),/cancellation/);
 for(const text of ['本日の発売を開始しました','本日開催中','<!-- 本日発売中 -->'])assert.throws(()=>verifyGamagoriStatus(text),/status_unknown/);
 const cancelled=readFileSync(new URL('../tests/fixtures/gamagori/official-postponed-index-20240831.html',import.meta.url),'utf8');
 assert.throws(()=>verifyGamagoriStatus(cancelled,{date:'2024-08-31',race:1}),/cancellation/);
 assert.throws(()=>verifyGamagoriStatus(cancelled,{date:'2026-10-31',race:1}),/status_unknown/);
});
