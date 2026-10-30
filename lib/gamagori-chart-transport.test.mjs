// Local real HTTP transport tests: no requests to the official site or production DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { collectCharts } from './gamagori-chart-collector.mjs';
import { parseGamagoriChart } from './gamagori-chart-parser.ts';
const fixture=readFileSync(new URL('../tests/fixtures/gamagori/20250809-01.html',import.meta.url),'utf8');
function fakeDb() {
  const inserted=[];
  return {inserted,from(table){let write=false;const q={select(){return q},eq(){return q},gte(){return q},lte(){return q},
    upsert(rows){write=true;inserted.push(...rows);return q},
    then(resolve){resolve({data:table==='bs_race_events'?[{race_no:1}]:write?inserted:[],error:null})}};return q}};
}
async function transport(t,handler) {
  const server=createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close()});
  return `http://127.0.0.1:${server.address().port}/`;
}
test('HTTP 503 retries once and parses official fixture before six-row insert',async t=>{
  let calls=0;const url=await transport(t,(req,res)=>{calls++;res.statusCode=calls===1?503:200;res.end(calls===1?'temporary':fixture)});
  const db=fakeDb();const result=await collectCharts({db,parse:parseGamagoriChart,date:'2025-08-09',first:1,limit:1,sleep:async()=>{},fetcher:(_,opts)=>fetch(url,opts)});
  assert.equal(calls,2);assert.equal(result.results[0].upstream_attempts,2);assert.equal(db.inserted.length,6);
});
test('real HTTP timeout aborts twice and writes zero rows (short test timeout)',async t=>{
  let calls=0;const url=await transport(t,(req,res)=>{calls++; /* intentionally no response */});
  const db=fakeDb();const start=Date.now();const result=await collectCharts({db,parse:parseGamagoriChart,date:'2025-08-09',first:1,limit:1,
    fetchTimeoutMs:80,sleep:async()=>{},fetcher:(_,opts)=>fetch(url,opts)});
  assert.equal(calls,2);assert.equal(result.results[0].reason,'upstream_timeout_or_network');assert.equal(db.inserted.length,0);assert(Date.now()-start<2000);
});
