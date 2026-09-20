import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { parseProfile, fetchProfile } from '../lib/racer-profile-sync.js';

const candidate = { racer_registration_no: '04320', racer_name: '出走表氏名' };
const html = '<h1>公式　氏名（出場予定）</h1>' + Object.entries({
  登録番号:'4320',生年月日:'1980/01/02',支部:'愛知',出身地:'愛知県',級別:'A1級',
  登録期:'95期',身長:'170cm',体重:'52.5kg',血液型:'AB型'
}).map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');

test('official fields, normalized key, and identity validation',()=>{
  const p=parseProfile(html,candidate);
  assert.deepEqual([p.registration_no,p.name,p.birthday,p.branch,p.birthplace,p.racer_class,p.registration_term,p.height_cm,p.weight_kg,p.blood_type],
    ['04320','公式氏名','1980-01-02','愛知','愛知県','A1',95,170,52.5,'AB']);
  assert.throws(()=>parseProfile(html,{racer_registration_no:'04321'}),/mismatch/);
  assert.throws(()=>parseProfile(html.replace('1980/01/02','--'),candidate),/parse_failed/);
});

test('one retry only; cancellation stops retries',async()=>{
  const original=globalThis.fetch;let calls=0;
  try{
    globalThis.fetch=async()=>{calls++;return {ok:false,status:503};};
    await assert.rejects(fetchProfile(candidate),/retry_failed/);assert.equal(calls,2);
    calls=0;
    globalThis.fetch=async()=>{calls++;return calls===1?{ok:false,status:503}:{ok:true,text:async()=>html};};
    assert.equal((await fetchProfile(candidate)).registration_no,'04320');assert.equal(calls,2);
    calls=0;
    globalThis.fetch=async()=>{calls++;throw new Error('aborted');};
    await assert.rejects(fetchProfile(candidate,AbortSignal.abort()),/aborted/);assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
});

async function loadRoute(db,fetcher,now=Date.parse('2026-09-20T16:00:00Z')){
  class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const context=vm.createContext({process:{env:{CRON_SECRET:'test-secret'}},Date:Clock,Intl,AbortSignal,console:{info(){},error(){}},setTimeout:(fn)=>setTimeout(fn,0)});
  const mocks={NextResponse:{json:(body,options={})=>({body,status:options.status||200})},getAdminSupabase:()=>db,fetchProfile:fetcher};
  const source=await fs.readFile(new URL('../app/api/cron/racer-master-sync/route.js',import.meta.url),'utf8');
  const module=new vm.SourceTextModule(source,{context});
  await module.link(async specifier=>{
    const key=specifier==='next/server'?'NextResponse':specifier.includes('supabaseAdmin')?'getAdminSupabase':'fetchProfile';
    return new vm.SyntheticModule([key],function(){this.setExport(key,mocks[key]);},{context});
  });await module.evaluate();return module.namespace.GET;
}
function database(){
  const writes=[];let page=0;const filters=[];
  const db={writes,filters,from(table){
    const q={op:'read',values:null,select(){return this;},eq(k,v){filters.push([k,v]);return this;},not(){return this;},order(){return this;},range(){return this;},in(){return this;},upsert(values){this.op='write';this.values=values;return this;},abortSignal(){return this;},then(resolve,reject){
      if(this.op==='write'){assert.ok(['bs_racers','bs_racer_sync_queue'].includes(table));writes.push([table,this.values]);return Promise.resolve({error:null}).then(resolve,reject);}
      let result;
      if(table==='bs_race_entries'){result={data:page++===0?Array.from({length:500},()=>({racer_registration_no:'04320'})):[{racer_registration_no:'4321',racer_name:'新選手'}]};}
      else result={data:[{registration_no:'04320'}],count:1285};
      return Promise.resolve(result).then(resolve,reject);
    }};return q;
  },rpc(name,args){assert.equal(name,'bs_racer_sync_candidates');assert.equal(args.p_limit,4);return {abortSignal:()=>Promise.resolve({data:[1,2,3,4,5].map(n=>({racer_registration_no:String(4320+n).padStart(5,'0')}))})};}};return db;
}
test('unauthorized requests do not touch database',async()=>{
  const get=await loadRoute(null,()=>assert.fail());
  assert.equal((await get({headers:new Headers()})).status,401);
});
test('JST date, pagination, missing-only enqueue, four cap, failure isolation, write scope',async()=>{
  const db=database();let fetched=0;
  const get=await loadRoute(db,async c=>{fetched++;if(c.racer_registration_no==='04322')throw new Error('retry_failed');return {registration_no:c.racer_registration_no,name:'公式氏名'};});
  const res=await get({headers:new Headers({authorization:'Bearer test-secret'})});
  assert.equal(res.status,207);assert.equal(res.body.today,'2026-09-21');
  assert.equal(fetched,4);assert.equal(res.body.synced,3);assert.equal(res.body.failed.length,1);
  assert.equal(db.writes[0][0],'bs_racer_sync_queue');
  assert.deepEqual(Array.from(db.writes[0][1],x=>x.registration_no),['04321']);
  assert.equal(db.filters.length,2);assert.equal(db.filters[0][1],'2026-09-21');
});
