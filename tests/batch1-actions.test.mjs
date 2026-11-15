import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fakeDb} from './fixtures/batch1-db.mjs';
import {validDataLabDate} from '../lib/dataLabSocialClaim.js';
const source=readFileSync(new URL('../app/admin/data-lab-social/page.js',import.meta.url),'utf8');
const action=source.slice(source.indexOf('async function generateOutput('),source.indexOf('\nasync function loadNewsForDate'));
async function run({auth=true,confirm='yes',date='2026-11-14',digest=true,fail=false}={}) {
  let calls=0,clients=0;const db=fakeDb({bs_daily_result_digests:digest?[{race_date:date,status:'complete'}]:[]});
  const fn=new Function('isAdminAuthenticated','redirect','validDataLabDate','getClient','generateDataLabSocialOutputs',action+'; return generateOutput;')(
    async()=>auth,url=>{throw {redirect:url};},validDataLabDate,()=>{clients++;return db.client;},async opts=>{calls++;assert.equal(opts.generateDigestIfMissing,false);if(fail)throw Error('secret-fixture');return {ok:true};});
  let result;try {await fn(new Map([['confirm',confirm],['date',date]]));}catch(e){result=e;}
  return {result,calls,clients,writes:db.writes};
}
test('unauthenticated action redirects before DB access',async()=>{const r=await run({auth:false});assert.equal(r.result.redirect,'/admin-login');assert.equal(r.clients,0);});
test('unconfirmed action never generates',async()=>{const r=await run({confirm:'no'});assert.match(r.result.redirect,/unconfirmed/);assert.equal(r.calls,0);assert.equal(r.clients,0);});
test('impossible date rejected before DB access',async()=>{const r=await run({date:'2026-02-30'});assert.equal(r.clients,0);assert.equal(r.calls,0);});
test('incomplete digest prevents generation',async()=>{const r=await run({digest:false});assert.equal(r.calls,0);assert.equal(r.writes.length,0);});
test('confirmed action uses nonpublishing manual generation',async()=>{const r=await run();assert.equal(r.calls,1);assert.match(r.result.redirect,/gen=ok/);});
test('action error does not reflect raw generator secrets',async()=>{const r=await run({fail:true});assert.doesNotMatch(r.result.redirect,/secret-fixture/);assert.match(r.result.redirect,/gen=error/);});
test('render loader performs SELECTs only',async()=>{
  const loader=source.slice(source.indexOf('async function loadOutput('),source.indexOf('\nasync function generateOutput'));
  const db=fakeDb();const fn=new Function('getClient','OUTPUT_COLUMNS',loader+';return loadOutput;')(()=>db.client,'*');
  await fn('2026-11-14');assert.equal(db.writes.length,0);assert.doesNotMatch(loader,/generateDataLab|\.upsert\(|\.update\(|\.delete\(/);
  assert.match(source,/if \(!\(await isAdminAuthenticated\(\)\)\) redirect\("\/admin-login"\);\n  const params/);
});
