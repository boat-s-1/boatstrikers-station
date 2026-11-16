import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./openapi-atomic-cron-caller.candidate.sql',import.meta.url),'utf8');
test('single transaction and no duplicate SQL tail',()=>{
 assert.equal((sql.match(/\bCOMMIT;/g)||[]).length,1);
 assert.equal((sql.match(/\bCREATE OR REPLACE FUNCTION public\.bs_sync_openapi_today_atomic_candidate\(/g)||[]).length,1);
 assert.match(sql,/RETURN public\.bs_apply_openapi_atomic_candidate\(/);
});
test('exact numeric racer registration and duplicate placing fail-closed',()=>{
 assert.match(sql,/length\(bv->>'number'\) NOT IN \(4,5\)/);
 assert.match(sql,/translate\(bv->>'number','0123456789',''\) <> ''/);
 assert.match(sql,/GROUP BY r\.sk,r\.rk,p\.value->>'place_number' HAVING count\(\*\)>1/);
});
test('Cron caller never changes active Cron job',()=>{
 assert.doesNotMatch(sql,/cron\.schedule\s*\(|cron\.unschedule\s*\(|UPDATE\s+cron\.job/i);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.bs_sync_openapi_today_atomic_candidate/);
});

test('database Cron bootstrap includes all fields emitted by Next.js bootstrap mapper',()=>{
 const route=readFileSync(new URL('../../app/api/live/openapi-preview/route.js',import.meta.url),'utf8');
 const section=route.slice(route.indexOf('function buildPayload('),route.indexOf('async function syncPreview('));
 const eventBlock=section.slice(section.indexOf('bootstrapEventRows.push({'),section.indexOf('});',section.indexOf('bootstrapEventRows.push({')));
 const entryBlock=section.slice(section.indexOf('bootstrapEntryRows.push({'),section.indexOf('});',section.indexOf('bootstrapEntryRows.push({')));
 for(const [name,block] of [['event',eventBlock],['entry',entryBlock]]){
  const keys=[...block.matchAll(/^\s{10}(\w+):/gm)].map(m=>m[1]);
  assert.ok(keys.length >= (name==='event'?7:14),name+' mapper keys extracted');
  for(const key of keys) assert.ok(sql.includes("'"+key+"'"),name+' field missing: '+key);
 }
});
