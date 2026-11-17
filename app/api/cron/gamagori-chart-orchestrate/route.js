import {createIsolatedGamagoriClient} from '../../../../lib/gamagori-environment.mjs';
import {createClient} from '@supabase/supabase-js';
import {gamagoriAuthorized,gamagoriDatabaseOptions} from '../../../../lib/gamagori-chart-http.mjs';
import {jstDate,validDate,orchestrateGamagori,gamagoriRepository} from '../../../../lib/gamagori-chart-orchestrator.mjs';
import {withGamagoriLease} from '../../../../lib/gamagori-chart-lease.mjs';
import {collectCharts} from '../../../../lib/gamagori-chart-collector.mjs';
import {parseGamagoriChart} from '../../../../lib/gamagori-chart-parser';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request) {
 if(!gamagoriAuthorized(request))return Response.json({error:'unauthorized'},{status:401});
 // This is a separate kill switch, not a Cron registration or production enablement.
 if(process.env.GAMAGORI_ORCHESTRATOR_ENABLED!=='true')return Response.json({status:'disabled'});
 const date=new URL(request.url).searchParams.get('date')??jstDate(Date.now());
 if(!validDate(date)||date>jstDate(Date.now()))return Response.json({error:'invalid_date'},{status:400});
 try{
  const db=await createIsolatedGamagoriClient(createClient);
  const leased=await withGamagoriLease(db,owner=>orchestrateGamagori({repo:gamagoriRepository(db),date,owner,
   collect:options=>collectCharts({db,parse:parseGamagoriChart,...options})}));
  if(leased.busy)return Response.json({error:'collector_busy'},{status:409,headers:{'Retry-After':'120'}});
  console.info('gamagori_orchestrate',JSON.stringify(leased.value));
  return Response.json(leased.value,{status:['calendar_unknown','event_data_missing','safety_wait'].includes(leased.value.outcome)?503:leased.value.results.some(r=>r.status==='failed'||r.status==='blocked_partial_existing')?207:200});
 }catch{
  console.error('gamagori_orchestrate',JSON.stringify({date,error:'orchestration_failed'}));
  return Response.json({error:'orchestration_failed'},{status:502});
 }
}

