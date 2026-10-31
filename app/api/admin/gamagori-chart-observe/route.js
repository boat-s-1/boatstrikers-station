import {createIsolatedGamagoriClient} from '../../../../lib/gamagori-environment.mjs';
import {createClient} from '@supabase/supabase-js';
import {gamagoriAuthorized,gamagoriDatabaseOptions} from '../../../../lib/gamagori-chart-http.mjs';
import {jstDate} from '../../../../lib/gamagori-date.mjs';
import {fetchGamagoriObservation,appendGamagoriObservation,gamagoriObservationSummary} from '../../../../lib/gamagori-observations.mjs';
import {withGamagoriLease} from '../../../../lib/gamagori-chart-lease.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
// Explicit POST: append collector-only evidence. Does not call a chart collector or enable a Cron.
export async function POST(request){
 if(process.env.VERCEL_ENV!=='preview')return Response.json({error:'not_available'},{status:404});
 if(!gamagoriAuthorized(request))return Response.json({error:'unauthorized'},{status:401});
 let body;try{
  if(Number(request.headers.get('content-length')??0)>128||!request.body)throw Error();
  const reader=request.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>128){await reader.cancel();throw Error();}chunks.push(value);}
  body=JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));if(!body||typeof body!=='object'||Array.isArray(body))throw Error();
 }catch{return Response.json({error:'invalid_request'},{status:400});}
 const race=body.race,date=jstDate(Date.now());
 if(!Number.isInteger(race)||race<1||race>12||Object.keys(body).some(k=>k!=='race'))return Response.json({error:'invalid_race'},{status:400});
 try{
  const db=await createIsolatedGamagoriClient(createClient);
  // Fail before upstream traffic if the reviewed schema has not been installed.
  const schema=await db.from('bsc_gamagori_observations').select('id').limit(0);if(schema.error)return Response.json({error:'observation_schema_unavailable'},{status:503});
  const {data,error}=await db.rpc('bsc_gamagori_meeting_evidence',{p_date:date});if(error)throw Error();
  const row=data?.races?.find(r=>r.race_no===race);if(!row)return Response.json({error:'event_unavailable'},{status:503});
  const leased=await withGamagoriLease(db,async()=>{
   const observation=await fetchGamagoriObservation({date,race,entries:row.entries,deadline:row.deadline});
   const stored=await appendGamagoriObservation(db,observation);
   return {observation:stored,validation_result:observation.validation_result,reason:observation.reason,sale_state:observation.sale_state,collection_permitted:false,collection_executed:false};
  });
  if(leased.busy)return Response.json({error:'collector_busy'},{status:409,headers:{'Retry-After':'120'}});
  return Response.json(leased.value,{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'observation_failed',collection_permitted:false},{status:503});}
}
export async function GET(request){
 if(process.env.VERCEL_ENV!=='preview')return Response.json({error:'not_available'},{status:404});
 if(!gamagoriAuthorized(request))return Response.json({error:'unauthorized'},{status:401});
 const query=new URL(request.url).searchParams,race=Number(query.get('race')??1);
 if(!Number.isInteger(race)||race<1||race>12||[...query.keys()].some(k=>k!=='race'))return Response.json({error:'invalid_race'},{status:400});
 try{
  const db=await createIsolatedGamagoriClient(createClient),date=jstDate(Date.now());
  const base=()=>db.from('bsc_gamagori_observations').select('id,recorded_at,checked_at,validation_result,reason,sale_state').eq('race_date',date).eq('race_no',race).order('recorded_at',{ascending:false}).limit(1);
  const [latest,verified]=await Promise.all([db.rpc('bsc_gamagori_latest_observation',{p_date:date,p_race:race}),base().not('checked_at','is',null)]);
  if(latest.error||verified.error)return Response.json({error:'observation_schema_unavailable'},{status:503});
  return Response.json({date,race,latest:latest.data??null,last_content_checked_at:verified.data?.[0]?.checked_at??null,collection_permitted:false,sale_contract:'requires_fresh_exact_race_proof'},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'observation_failed',collection_permitted:false},{status:503});}
}
