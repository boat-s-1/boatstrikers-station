import {databaseMeetingEvidence,isRaceCancelled} from './gamagori-meeting-policy.mjs';
import { randomUUID } from 'node:crypto';
import {loadGamagoriProgram} from './gamagori-program-safety.mjs';
import {jstDate} from './gamagori-date.mjs';
export {jstDate,validDate} from './gamagori-date.mjs';
export function parseGamagoriCalendar(html,date) {
 if (!html.includes('開催期間/日次')) throw Error('calendar_invalid');
 const meetings=[...html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/href=["']([^"']*\/owpc\/pc\/race\/raceindex\?[^"']+)["']/g)].map(m=>new URL(m[1].replaceAll('&amp;','&'),'https://www.boatrace.jp'))
   .filter(u=>u.origin==='https://www.boatrace.jp' && u.pathname==='/owpc/pc/race/raceindex' && u.searchParams.get('hd')===date.replaceAll('-','') && /^\d{2}$/.test(u.searchParams.get('jcd')??''));
 if (!meetings.length) throw Error('calendar_invalid'); // Empty/changed/error pages are unknown, never non-meeting.
 return meetings.some(u=>u.searchParams.get('jcd')==='07')?'held':'no_meeting';
}
export async function loadGamagoriCalendar(date,fetcher=fetch) {
 let response;
 try { response=await fetcher(`https://www.boatrace.jp/owpc/pc/race/index?hd=${date.replaceAll('-','')}`,{signal:AbortSignal.timeout(8000),redirect:'error',cache:'no-store',headers:{'User-Agent':'BoatStrikers bounded meeting calendar verification (boat-strike.online)'}}); }
 catch(e){throw Error(e.name==='TimeoutError'||e.name==='AbortError'?'calendar_timeout':'calendar_network_error');}
 if(!response.ok){await response.body?.cancel();throw Error(`calendar_http_${response.status}`);}
 const reader=response.body.getReader();const chunks=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>400000){await reader.cancel();throw Error('calendar_invalid');}chunks.push(value);}
 return parseGamagoriCalendar(new TextDecoder().decode(Buffer.concat(chunks)),date);
}
export function dueTasks(state,date,now) {
 return state.tasks.filter(t=>t.status==='pending' && t.attempts<6 && (!t.next_attempt_at || Date.parse(t.next_attempt_at)<=now))
  .map(task=>({task,event:state.events.find(e=>e.race_no===task.race_no)}))
  .filter(({event})=>event && (!event.race_cancel_code || event.race_cancel_code==='0') && (date<jstDate(now) || (event.deadline_time &&
    Date.parse(`${date}T${event.deadline_time}+09:00`)-6*60000<=now)))
  .sort((a,b)=>(a.task.last_attempt_at?Date.parse(a.task.last_attempt_at):0)-(b.task.last_attempt_at?Date.parse(b.task.last_attempt_at):0)||a.task.race_no-b.task.race_no).slice(0,3);
}
// repo checkpoints are durable before fetching. Reconciliation derives completion from saved six-boat charts.
export async function orchestrateGamagori({repo,collect,date,owner,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),calendar=loadGamagoriCalendar,programSafety=loadGamagoriProgram}) {
 const started=now(),deadline=started+38000,run=randomUUID();let results=[];let outcome='idle';let calendarError;let safetyReason;let meetingSource='not_needed';
 const state=await repo.prepare(date,run);
 try {
  if(date===jstDate(now())&&repo.observationMode===true){
   outcome='waiting_or_complete';meetingSource='verified_observation_gate';
   if(state.day.blocked_until&&Date.parse(state.day.blocked_until)>now())outcome='cooldown';
   else for(const {task} of dueTasks({...state,events:state.events.filter(e=>e.deadline_time&&Date.parse(`${date}T${e.deadline_time}+09:00`)>now())},date,now())){
    if(now()+20000>deadline){outcome='time_budget';break;}
    if(!await repo.claim(date,task.race_no,owner))continue;
    const response=await collect({date,first:task.race_no,limit:1,deadlineAt:deadline});
    const result=response.results[0]??{race:task.race_no,status:'blocked_safety',reason:'observed_time_budget',upstream_attempts:0};
    results.push(result);await repo.finishTask(date,task,result);
    if(!['saved','skipped_existing'].includes(result.status)){outcome='safety_wait';await repo.halt(date);break;}
    outcome='collected';
   }
   await repo.finishRun(run,'completed',outcome,results);return {date,run,outcome,meeting_source:meetingSource,results};
  }
  if(state.day.blocked_until && Date.parse(state.day.blocked_until)>now())outcome='cooldown';
  else {
   const evidence=repo.meetingEvidence?await repo.meetingEvidence(date):null;
   const proof=databaseMeetingEvidence(evidence,date,now());
   const cancelled=new Set(evidence?.date===date?(evidence.races??[]).filter(isRaceCancelled).map(r=>r.race_no):[]);
   state.events=state.events.filter(e=>!cancelled.has(e.race_no));
   const hasCandidates=dueTasks(state,date,now()).length>0;
   let meeting=state.day.calendar_status;
   const dbCache=String(state.day.evidence_source??'').startsWith('db_');
   const fresh=!dbCache && state.day.checked_at && now()-Date.parse(state.day.checked_at)<(meeting==='unknown'?1800000:21600000);
   if(proof.status==='cancelled'){meeting='cancelled';meetingSource=proof.source;}
   else if(proof.status==='held'){
    if(date!==jstDate(now())&&fresh&&meeting==='no_meeting'){meeting='unknown';calendarError='calendar_conflict';meetingSource='conflict';}
    else {meeting='held';meetingSource=proof.source;state.events=state.events.filter(e=>proof.eligibleRaces.includes(e.race_no));await repo.day(date,'held',proof.source,proof.expiresAt);}
   }else if(date===jstDate(now())){meeting='waiting_fresh_evidence';meetingSource='db_safety_gate';safetyReason='fresh_six_boat_evidence_required';}
   else if(!hasCandidates && state.events.length){meeting='not_due';}
   else if(!fresh){try{meeting=await calendar(date);}catch(e){meeting='unknown';calendarError=/^calendar_(?:http_\d{3}|timeout|network_error|invalid)$/.test(e.message)?e.message:'calendar_unavailable';}meetingSource='official_html';await repo.day(date,meeting,'official_html');}
   else meetingSource=state.day.evidence_source??'legacy_official_cache';
   if(meeting==='waiting_fresh_evidence')outcome='waiting_fresh_evidence';
   else if(meeting==='not_due')outcome='waiting_not_due';
   else if(meeting==='cancelled')outcome='cancelled';
   else if(meeting==='no_meeting')outcome='non_meeting';
   else if(meeting!=='held')outcome='calendar_unknown';
   else if(!state.events.length)outcome='event_data_missing';
   else {
    const candidates=dueTasks(state,date,now());outcome=candidates.length?'collected':'waiting_or_complete';
    for(const {task} of candidates) {
     if(now()+15000>deadline){outcome='time_budget';break;}
     if(date===jstDate(now())){
      const latest=await repo.meetingEvidence(date),current=databaseMeetingEvidence(latest,date,now());
      if(current.status!=='held'||!current.eligibleRaces.includes(task.race_no)||Date.parse(current.expiresAt)<=now()) {outcome='safety_wait';results.push({race:task.race_no,status:'blocked_safety',reason:'evidence_expired_or_changed',upstream_attempts:0});break;}
      const race=latest.races.find(r=>r.race_no===task.race_no);
      try{const checked=await programSafety({date,race:task.race_no,deadline:race.deadline,entries:race.entries,deadlineAt:deadline});
       if(checked.source!=='gamagori_official_program'||!checked.checked_at||Math.abs(now()-Date.parse(checked.checked_at))>60000)throw Error('program_response_stale');
       results.push({race:task.race_no,status:'safety_confirmed',...checked});await sleep(1500);
      }catch(e){const reason=/^program_[a-z_0-9]+$/.test(e.message)?e.message:'program_check_failed';outcome='safety_wait';results.push({race:task.race_no,status:'blocked_safety',reason,upstream_attempts:0});if(['program_http_403','program_http_429','program_status_unknown','program_response_stale'].includes(reason))await repo.halt(date);break;}
      if(Date.parse(current.expiresAt)<=now()||now()+15000>deadline){outcome='safety_wait';results.push({race:task.race_no,status:'blocked_safety',reason:'evidence_expired_or_budget',upstream_attempts:0});break;}
     }
     if(!await repo.claim(date,task.race_no,owner))continue;
     const response=await collect({date,first:task.race_no,limit:1,deadlineAt:deadline});
     const result=response.results[0]??{race:task.race_no,status:'failed',reason:'time_budget_exhausted',upstream_attempts:0};
     results.push(result);await repo.finishTask(date,task,result);
     if(['upstream_http_403','upstream_http_429'].includes(result.reason)){await repo.halt(date);outcome='upstream_cooldown';break;}
     if(result.upstream_attempts>0)await sleep(1500);
    }
   }
  }
  await repo.finishRun(run,'completed',outcome,results);
  return {date,run,outcome,meeting_source:meetingSource,results,...(calendarError?{calendar_error:calendarError}:{}),...(safetyReason?{safety_reason:safetyReason}:{})};
 }catch{
  try{await repo.finishRun(run,'failed','orchestration_failed',results);}catch{}
  throw Error('orchestration_failed');
 }
}
export function gamagoriRepository(db) {
 const checked=async p=>{const r=await p;if(r.error)throw Error('orchestrator_database_failed');return r.data;};
 return {
  observationMode:true,
  prepare:(date,run)=>checked(db.rpc('bsc_gamagori_orchestrator_prepare',{p_date:date,p_run:run})),
  meetingEvidence:date=>checked(db.rpc('bsc_gamagori_meeting_evidence',{p_date:date})),
  day:(date,status,source='official_html',expiry=null)=>checked(db.from('bsc_gamagori_collection_days').update({calendar_status:status,checked_at:new Date().toISOString(),evidence_source:source,evidence_expires_at:expiry}).eq('race_date',date)),
  halt:date=>checked(db.from('bsc_gamagori_collection_days').update({blocked_until:new Date(Date.now()+1800000).toISOString()}).eq('race_date',date)),
  claim:(date,race,owner)=>checked(db.rpc('bsc_gamagori_claim_task',{p_date:date,p_race:race,p_owner:owner})),
  finishTask:(date,task,result)=>{
   const complete=['saved','skipped_existing'].includes(result.status),blocked=['blocked_partial_existing','concurrent_existing'].includes(result.status);
   return checked(db.from('bsc_gamagori_collection_tasks').update({status:complete?'complete':blocked?'blocked':task.attempts+1>=6?'exhausted':'pending',
    next_attempt_at:complete?null:new Date(Date.now()+120000).toISOString(),last_reason:result.reason??result.status,
    upstream_attempts:task.upstream_attempts+(result.upstream_attempts??0)}).eq('race_date',date).eq('race_no',task.race_no));
  },
  finishRun:(run,status,outcome,results)=>checked(db.from('bsc_gamagori_collection_runs').update({status,outcome,results,finished_at:new Date().toISOString()}).eq('id',run))
 };
}

