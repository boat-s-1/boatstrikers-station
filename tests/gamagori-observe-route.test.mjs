import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {gamagoriObservationSummary} from '../lib/gamagori-observations.mjs';
const code=readFileSync(new URL('../app/api/admin/gamagori-chart-observe/route.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export ','');
const load=(deps,method='POST')=>new Function('deps',`const {createClient,gamagoriAuthorized,gamagoriDatabaseOptions,jstDate,fetchGamagoriObservation,appendGamagoriObservation,gamagoriObservationSummary,withGamagoriLease}=deps;${code};return ${method};`)(deps);
function harness({authorized=true,schema=true,busy=false,saveFails=false}={}){
 const calls=[];const db={from(name){assert.equal(name,'bsc_gamagori_observations');return {select(){return {limit:async()=>({error:schema?null:{code:'missing'}})}}}},rpc:async name=>{assert.equal(name,'bsc_gamagori_meeting_evidence');return {data:{races:[{race_no:1,entries:[],deadline:'15:21:00'}]}};}};
 const route=load({createClient:()=>{calls.push('db');return db},gamagoriAuthorized:()=>authorized,gamagoriDatabaseOptions:()=>({}),jstDate:()=> '2026-10-31',withGamagoriLease:async(db,fn)=>busy?{busy:true}:{value:await fn()},fetchGamagoriObservation:async()=>{calls.push('fetch');return {validation_result:'verified_content',reason:'content_verified_sale_unknown',sale_state:'unknown'}},appendGamagoriObservation:async()=>{calls.push('append');if(saveFails)throw Error('sensitive detail');return {id:'test',checked_at:'2026-10-31T05:00:00Z'};}});
 return {route,calls};
}
const request=(body='{"race":1}')=>new Request('https://example.test/api/admin/gamagori-chart-observe',{method:'POST',body});
async function preview(fn){const old={VERCEL_ENV:process.env.VERCEL_ENV,NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY};try{process.env.VERCEL_ENV='preview';process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='unit-only';await fn();}finally{for(const [k,v] of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}}
test('actual observer handler rejects production and unauthorized requests before DB or network',async()=>preview(async()=>{
 const h=harness();process.env.VERCEL_ENV='production';assert.equal((await h.route(request())).status,404);assert.deepEqual(h.calls,[]);
 process.env.VERCEL_ENV='preview';const u=harness({authorized:false});assert.equal((await u.route(request())).status,401);assert.deepEqual(u.calls,[]);
}));
test('handler bounds malformed/oversized/extra identity request before database access',async()=>preview(async()=>{
 for(const input of ['null','[]','{"race":0}','{"race":1,"date":"2026-10-30"}','x'.repeat(129)]){const h=harness();assert.equal((await h.route(request(input))).status,400);assert.deepEqual(h.calls,[]);}
}));
test('uninstalled schema fails before official access or persistence',async()=>preview(async()=>{
 const h=harness({schema:false});const r=await h.route(request());assert.equal(r.status,503);assert.equal((await r.json()).error,'observation_schema_unavailable');assert.deepEqual(h.calls,['db']);
}));
test('collector lease contention prevents observer official traffic and appends',async()=>preview(async()=>{
 const h=harness({busy:true});assert.equal((await h.route(request())).status,409);assert.deepEqual(h.calls,['db']);
}));
test('content-only successful append never starts chart collection or returns normal sale',async()=>preview(async()=>{
 const h=harness();const r=await h.route(request()),v=await r.json();assert.equal(r.status,200);assert.equal(v.collection_permitted,false);assert.equal(v.collection_executed,false);assert.equal(v.sale_state,'unknown');assert.deepEqual(h.calls,['db','fetch','append']);
}));
test('persistence error is redacted and stops handler',async()=>preview(async()=>{
 const h=harness({saveFails:true});const r=await h.route(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'observation_failed',collection_permitted:false});
}));
test('GET monitor preserves latest negative alongside separate last content confirmation',async()=>preview(async()=>{
 let reads=0;const old={id:'old',recorded_at:'2026-10-31T05:00:00Z',checked_at:'2026-10-31T05:00:00Z'},latest={id:'latest',recorded_at:'2026-10-31T05:01:00Z',checked_at:null};
 const route=load({gamagoriAuthorized:()=>true,gamagoriDatabaseOptions:()=>({}),jstDate:()=> '2026-10-31',gamagoriObservationSummary,createClient:()=>({from(name){reads++;assert.equal(name,'bsc_gamagori_observations');let verified=false;const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,not:()=>{verified=true;return q},then(resolve){resolve({data:verified?[old]:[latest]});}};return q;}})},'GET');
 const r=await route(new Request('https://example.test?race=1')),v=await r.json();assert.equal(r.status,200);assert.equal(v.latest.id,'latest');assert.equal(v.last_content_checked_at,old.checked_at);assert.equal(v.collection_permitted,false);assert.equal(reads,2);
}));
test('GET monitor also enforces Preview and API authorization before database reads',async()=>preview(async()=>{
 let reads=0;const deps={createClient:()=>{reads++;throw Error()},gamagoriAuthorized:()=>false};let route=load(deps,'GET');assert.equal((await route(new Request('https://example.test'))).status,401);
 process.env.VERCEL_ENV='production';route=load({...deps,gamagoriAuthorized:()=>true},'GET');assert.equal((await route(new Request('https://example.test'))).status,404);assert.equal(reads,0);
}));
