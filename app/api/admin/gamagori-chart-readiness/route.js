import {createClient} from '@supabase/supabase-js';
import {gamagoriAuthorized,gamagoriDatabaseOptions} from '../../../../lib/gamagori-chart-http.mjs';
import {jstDate} from '../../../../lib/gamagori-date.mjs';
import {databaseMeetingEvidence} from '../../../../lib/gamagori-meeting-policy.mjs';
import {probeGamagoriPublication} from '../../../../lib/gamagori-chart-publication.mjs';
import {parseGamagoriChart} from '../../../../lib/gamagori-chart-parser';
import {loadGamagoriProgram} from '../../../../lib/gamagori-program-safety.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
export async function GET(request){
 if(process.env.VERCEL_ENV!=='preview')return Response.json({error:'not_available'},{status:404});
 if(!gamagoriAuthorized(request))return Response.json({error:'unauthorized'},{status:401});
 const query=new URL(request.url).searchParams,race=Number(query.get('race')??1);
 if(!Number.isInteger(race)||race<1||race>12)return Response.json({error:'invalid_race'},{status:400});
 const date=jstDate(Date.now());
 try{
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,gamagoriDatabaseOptions());
  const {data,error}=await db.rpc('bsc_gamagori_meeting_evidence',{p_date:date});if(error)throw Error('evidence_unavailable');
  const proof=databaseMeetingEvidence(data,date,Date.now());let program;
  if(query.get('probe_program')==='1'){
   const row=data?.races?.find(r=>r.race_no===race);
   try{if(!row)throw Error('program_event_missing');program=await loadGamagoriProgram({date,race,deadline:row.deadline,entries:row.entries,deadlineAt:Date.now()+10000});}
   catch(e){program={error:/^program_[a-z_0-9]+$/.test(e.message)?e.message:'program_check_failed'};}
  }
  let publication;
  if(query.get('probe_chart')==='1'){if(program)await new Promise(r=>setTimeout(r,1500));publication=await probeGamagoriPublication({date,race,parse:parseGamagoriChart});}
  const result={date,proof,chart_publication_probe_only:publication??null,program_probe_only:program??null,collection_executed:false,races:(data?.races??[]).map(r=>({race_no:r.race_no,boats:r.boats,preview_boats:r.preview_boats,preview_at:r.preview_at,entry_preview_at:r.entry_preview_at,deadline:r.deadline,cancel:r.cancel,status:r.status})),live_sync:data?.live_sync};
  console.info('gamagori_readiness',JSON.stringify(result));
  return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch{console.error('gamagori_readiness','evidence_unavailable');return Response.json({error:'evidence_unavailable'},{status:503});}
}
