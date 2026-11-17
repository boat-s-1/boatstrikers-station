import test from 'node:test';import assert from 'node:assert/strict';
import {probeGamagoriPublication} from './gamagori-chart-publication.mjs';
const args={date:'2026-10-31',race:1};
test('publication probe is read-only and distinguishes complete from incomplete chart',async()=>{
 let calls=0;const r=await probeGamagoriPublication({...args,parse:()=>Array.from({length:6},(_,i)=>({boat_no:i+1})),fetcher:async(url,init)=>{calls++;assert(url.endsWith('202610310701.htm'));assert.equal(init.redirect,'error');return new Response('fixture');}});
 assert.equal(calls,1);assert.equal(r.state,'published_complete');assert.equal(r.boats,6);
 const empty=await probeGamagoriPublication({...args,parse:()=>{throw Error('missing')},fetcher:async()=>new Response('<div id="chart"><table></table></div>')});assert.equal(empty.state,'unpublished_or_invalid');assert.equal(empty.marker_count,0);
});
test('publication probe does not mistake HTTP errors or oversized responses for availability',async()=>{
 for(const status of [403,404,429,503]){const r=await probeGamagoriPublication({...args,parse:()=>{throw Error('must not parse')},fetcher:async()=>new Response('',{status})});assert.equal(r.state,status===404?'unpublished':'unknown');}
 const big=await probeGamagoriPublication({...args,parse:()=>{throw Error('must not parse')},fetcher:async()=>new Response('x'.repeat(400001))});assert.equal(big.reason,'chart_too_large');
 const failed=await probeGamagoriPublication({...args,fetcher:async()=>{throw Error('network')}});assert.equal(failed.state,'unknown');
});
