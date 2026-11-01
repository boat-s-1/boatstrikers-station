// Offline replay into an ISOLATED local PostgreSQL directory. No network or Supabase credentials.
import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
import {validateGamagoriObservation} from '../lib/gamagori-observations.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(0,i),a.slice(i+1)];}));
for(const k of ['--documents','--db-evidence','--data-dir','--output'])if(!args[k])throw Error('required: --documents=PATH --db-evidence=PATH --data-dir=PATH --output=PATH');
const {PGlite}=await import(process.env.GAMAGORI_TEST_PGLITE_URL??'@electric-sql/pglite');
const documents=JSON.parse(readFileSync(args['--documents'],'utf8')),evidence=JSON.parse(readFileSync(args['--db-evidence'],'utf8'))[0].evidence;
const row=evidence.races.find(r=>r.race_no===1),captured=Math.max(...Object.values(documents).map(d=>Date.parse(d.received_at)));
// Freeze validator clock at captured response completion; this is a labelled replay, not fresh live proof.
const observation=validateGamagoriObservation({date:evidence.date,race:1,entries:row.entries,deadline:row.deadline,documents,now:captured});
const directory=resolve(args['--data-dir']);let db=new PGlite(directory);
const exists=(await db.query("select to_regclass('public.bsc_gamagori_observations') as name")).rows[0].name;
if(!exists){await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');await db.exec(readFileSync(new URL('../supabase/migrations/20261031051251_gamagori_append_only_observations.sql',import.meta.url),'utf8'));}
const record=async()=>(await db.query('select public.bsc_gamagori_record_observation($1::jsonb) as result',[JSON.stringify(observation)])).rows[0].result;
const first=await record(),retry=await record();await db.close();
db=new PGlite(directory);const persisted=(await db.query('select id,race_date,race_no,source,source_url,html_sha256,sources,boats,validation_result,reason,sale_state,fetched_at,recorded_at,checked_at,collection_permitted from public.bsc_gamagori_observations where id=$1',[observation.id])).rows;await db.close();
if(persisted.length!==1||retry.inserted!==false||retry.checked_at!==first.checked_at)throw Error('isolated_replay_failed');
const result={mode:'offline_replay_of_real_responses_into_isolated_local_postgres',capture_completed_at:new Date(captured).toISOString(),first,retry,persisted,chart_writes:0,production_writes:0};
writeFileSync(args['--output'],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({state:observation.validation_result,reason:observation.reason,persisted:1,retry_inserted:retry.inserted,checked_at:persisted[0].checked_at,chart_writes:0}));
