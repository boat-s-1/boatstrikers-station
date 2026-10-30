import {createClient} from '@supabase/supabase-js';
import {gamagoriAuthorized,gamagoriDatabaseOptions} from '../../../../lib/gamagori-chart-http.mjs';
import {jstDate,validDate} from '../../../../lib/gamagori-chart-orchestrator.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=10;
export async function GET(request) {
 if(!gamagoriAuthorized(request))return Response.json({error:'unauthorized'},{status:401});
 const date=new URL(request.url).searchParams.get('date')??jstDate(Date.now());
 if(!validDate(date))return Response.json({error:'invalid_date'},{status:400});
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return Response.json({error:'database_configuration_missing'},{status:503});
 try{
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,gamagoriDatabaseOptions());
  const {data,error}=await db.rpc('bsc_gamagori_chart_monitor',{p_date:date});
  if(error)throw Error('monitor_failed');
  return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'monitor_failed'},{status:502});}
}
