import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCharts } from './gamagori-chart-collector.mjs';
const marks = Array.from({length:6}, (_,i) => ({boat_no:i+1,slit_rating:4,turn_rating:3,arrow_direction:'none'}));
function setup({existing=[],events=[1,2,3],parse=()=>marks,fetcher=async()=>new Response('chart')}={}) {
  let clock=0; const calls=[]; const inserts=[];
  const db={from(table){let query={}; const q={select(){return q},eq(k,v){query[k]=v;return q},gte(){return q},lte(){return q},upsert(rows,options){assert.equal(options.ignoreDuplicates,true);inserts.push(rows);query.write=true;return q},then(resolve){resolve({data:table==='bs_race_events'?events.map(race_no=>({race_no})):query.write?marks:existing,error:null})}};return q}};
  return {calls,inserts,run:(opts={})=>collectCharts({db,parse,date:'2025-08-09',first:1,now:()=>clock,sleep:async ms=>{clock+=ms},fetcher:async (...args)=>{calls.push(clock);return fetcher(...args)},...opts})};
}
test('three races max, serial spacing, six-row inserts',async()=>{
  const s=setup();const r=await s.run();assert.equal(r.results.length,3);assert.equal(s.inserts.length,3);assert(s.inserts.every(x=>x.length===6));assert(s.calls[1]-s.calls[0]>=1500);assert(s.calls[2]-s.calls[1]>=1500);
});
test('existing and partial races never fetched or written',async()=>{
 for(const existing of [marks,marks.slice(0,5)]) {const s=setup({existing});const r=await s.run();assert.equal(s.calls.length,0);assert.equal(s.inserts.length,0);assert.equal(r.results[0].status,existing.length===6?'skipped_existing':'blocked_partial_existing');}
});
test('no event never fetched',async()=>{const s=setup({events:[]});await s.run();assert.equal(s.calls.length,0)});
test('invalid chart never saved',async()=>{const s=setup({parse:()=>{throw Error('bad')}});await s.run();assert.equal(s.inserts.length,0)});
test('temporary failure retried once',async()=>{let n=0;const s=setup({fetcher:async()=>++n===1?new Response('',{status:503}):new Response('chart')});const r=await s.run({limit:1});assert.equal(s.calls.length,2);assert.equal(r.results[0].status,'saved')});
test('403 and 429 stop entire batch without retry',async()=>{for(const status of [403,429]){const s=setup({fetcher:async()=>new Response('',{status})});const r=await s.run();assert.equal(s.calls.length,1);assert.equal(r.results.length,1);assert.equal(s.inserts.length,0)}});
test('404 not retried; network retried once; oversized body rejected',async()=>{
 for(const fetcher of [async()=>new Response('',{status:404}),async()=>{throw Error('secret should not escape')},async()=>new Response('x'.repeat(400001))]) {const s=setup({fetcher});const r=await s.run({limit:1});assert.equal(s.inserts.length,0);assert(!JSON.stringify(r).includes('secret'));assert(s.calls.length<=2);}
});
