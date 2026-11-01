import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {validateGamagoriObservation,gamagoriObservationSummary} from '../lib/gamagori-observations.mjs';
import {observationFixture} from './helpers/gamagori-observation-fixtures.mjs';
// Isolated real PostgreSQL engine. No Supabase credentials, network, or production writes.
const {PGlite}=await import(process.env.GAMAGORI_TEST_PGLITE_URL??'@electric-sql/pglite');
let db;
const good=()=>validateGamagoriObservation(observationFixture());
const record=async o=>(await db.query('select public.bsc_gamagori_record_observation($1::jsonb) as result',[JSON.stringify(o)])).rows[0].result;
before(async()=>{db=new PGlite();await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');await db.exec(readFileSync(new URL('../supabase/migrations/20261031051251_gamagori_append_only_observations.sql',import.meta.url),'utf8'));});
after(async()=>{await db.close();});
test('isolated migration enables RLS and denies all public table/function access',async()=>{
 const r=(await db.query(`select relrowsecurity from pg_class where oid='public.bsc_gamagori_observations'::regclass`)).rows[0];assert(r.relrowsecurity);
 for(const role of ['anon','authenticated']){const r=(await db.query(`select has_table_privilege($1,'public.bsc_gamagori_observations','SELECT') as can_read,has_table_privilege($1,'public.bsc_gamagori_observations','INSERT') as can_insert,has_function_privilege($1,'public.bsc_gamagori_record_observation(jsonb)','EXECUTE') as can_call`,[role])).rows[0];assert.deepEqual(r,{can_read:false,can_insert:false,can_call:false});}
});
test('service role append stores validated SIX-BOAT content with DB clock, never sale authorization',async()=>{
 await db.exec('set role service_role');try{const r=await record(good());assert.equal(r.inserted,true);assert(r.checked_at);assert.equal(r.collection_permitted,false);}finally{await db.exec('reset role');}
});
test('HTTP200 empty shell appends failure with NULL checked_at',async()=>{
 const r=await record(validateGamagoriObservation(observationFixture(Date.now(),false)));assert.equal(r.checked_at,null);assert.equal(r.collection_permitted,false);
});
test('same observation ID retry is idempotent and does not refresh checked_at',async()=>{
 const o=good(),first=await record(o),second=await record(o);assert.equal(second.inserted,false);assert.equal(second.checked_at,first.checked_at);
 const n=(await db.query('select count(*)::int as n from public.bsc_gamagori_observations where id=$1',[o.id])).rows[0].n;assert.equal(n,1);
});
test('same ID with altered content is rejected instead of overwriting evidence',async()=>{
 const o=good();await record(o);await assert.rejects(record({...o,reason:'changed'}),/observation_id_conflict/);
});
test('new successful observation may retain same body hashes and records a new confirmation',async()=>{
 const a=good();await record(a);const b={...a,id:randomUUID()};const r=await record(b);assert(r.inserted);assert(r.checked_at);
});
test('client-supplied checked_at/recorded_at cannot refresh failed observations',async()=>{
 const o=validateGamagoriObservation(observationFixture(Date.now(),false));const r=await record({...o,checked_at:'2099-01-01T00:00:00Z',recorded_at:'2099-01-01T00:00:00Z'});assert.equal(r.checked_at,null);
 const row=(await db.query('select recorded_at from public.bsc_gamagori_observations where id=$1',[o.id])).rows[0];assert(Date.parse(row.recorded_at)<Date.parse('2099-01-01'));
});
test('verified label without six boats, registrations, courses or valid values is rejected by SQL',async()=>{
 for(const change of [o=>o.boats.pop(),o=>o.boats[5].boat_no=1,o=>o.boats[5].registration=o.boats[0].registration,o=>o.boats[5].course=1,o=>o.boats[0].exhibition_time=null,o=>o.boats[0].registration=4000.5,o=>o.boats[0].boat_no=1.5]){const o=good();change(o);await assert.rejects(record(o));}
});
test('verified content requires all four independently identified sources',async()=>{
 for(const change of [o=>o.sources.pop(),o=>o.sources[3].kind='program',o=>o.sources[0].url='https://example.test/',o=>o.source_url+='?token=not-allowed',o=>o.sources[2].html_sha256='a'.repeat(64)]){const o=good();change(o);await assert.rejects(record(o));}
});
test('NULL/stale HTTP date, old fetch, future source, cache Age and non200 cannot set checked_at',async()=>{
 for(const change of [o=>o.sources[0].http_date=null,o=>o.sources[0].http_date='2026-01-01',o=>o.fetched_at='2026-01-01',o=>o.sources[0].received_at='2099-01-01',o=>o.sources[0].age=61,o=>o.sources[0].http_status=500,o=>o.sources[0].html_sha256=null]){const o=good();change(o);await assert.rejects(record(o));}
});
test('normal sale is not a supported v1 state and cannot be forged in SQL',async()=>{
 const o=good();o.sale_state='normal';await assert.rejects(record(o));
});
test('cancelled/postponed/withdrawn observations are append-only negatives, never checked',async()=>{
 for(const sale_state of ['cancelled','postponed','withdrawn']){const o={...good(),validation_result:'rejected',reason:'official_cancellation',sale_state};const r=await record(o);assert.equal(r.checked_at,null);}
});
test('service role has no UPDATE/DELETE/TRUNCATE rights',async()=>{
 const r=(await db.query(`select has_table_privilege('service_role','public.bsc_gamagori_observations','UPDATE') as u,has_table_privilege('service_role','public.bsc_gamagori_observations','DELETE') as d,has_table_privilege('service_role','public.bsc_gamagori_observations','TRUNCATE') as t`)).rows[0];assert.deepEqual(r,{u:false,d:false,t:false});
});
test('public roles cannot execute RPC or select evidence even with a valid observation payload',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);try{await assert.rejects(record(good()),/permission denied/);await assert.rejects(db.query('select * from public.bsc_gamagori_observations'),/permission denied/);}finally{await db.exec('reset role');}
 }
});
test('append-only trigger also blocks accidental owner UPDATE/DELETE/TRUNCATE',async()=>{
 for(const sql of [`update public.bsc_gamagori_observations set reason='changed'`,`delete from public.bsc_gamagori_observations`,`truncate public.bsc_gamagori_observations`])await assert.rejects(db.exec(sql),/observations_are_append_only/);
});
test('latest failure does not disappear behind historical verified content in monitoring',async()=>{
 const a=good();await record(a);const b={...a,id:randomUUID(),validation_result:'rejected',reason:'response_stale_or_unverified'};await record(b);
 const rows=(await db.query('select * from public.bsc_gamagori_observations where id=any($1::uuid[]) order by recorded_at desc',[[a.id,b.id]])).rows;
 const r=gamagoriObservationSummary(rows);assert.equal(r.latest.id,b.id);assert.equal(r.latest.checked_at,null);assert(r.last_content_checked_at);assert.equal(r.collection_permitted,false);
});
