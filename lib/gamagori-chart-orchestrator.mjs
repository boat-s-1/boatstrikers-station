import { randomUUID } from 'node:crypto';
export const jstDate = ms => new Date(ms+9*3600000).toISOString().slice(0,10);
export function validDate(date) {return /^20\d{2}-\d{2}-\d{2}$/.test(date??'') && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date;}
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
export async function orchestrateGamagori({repo,collect,date,owner,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),calendar=loadGamagoriCalendar}) {
 const started=now(),deadline=started+38000,run=randomUUID();let results=[];let outcome='idle';let calendarError;
 const state=await repo.prepare(date,run);
 try {
  if(state.day.blocked_until && Date.parse(state.day.blocked_until)>now())outcome='cooldown';
  else {
   let meeting=state.day.calendar_status;
   const fresh=state.day.checked_at && now()-Date.parse(state.day.checked_at)<(meeting==='unknown'?1800000:21600000);
   if(!fresh){try{meeting=await calendar(date);}catch(e){meeting='unknown';calendarError=/^calendar_(?:http_\d{3}|timeout|network_error|invalid)$/.test(e.message)?e.message:'calendar_unavailable';}await repo.day(date,meeting);}
   if(meeting==='no_meeting')outcome='non_meeting';
   else if(meeting!=='held')outcome='calendar_unknown';
   else if(!state.events.length)outcome='event_data_missing';
   else {
    const candidates=dueTasks(state,date,now());outcome=candidates.length?'collected':'waiting_or_complete';
    for(const {task} of candidates) {
     if(now()+15000>deadline){outcome='time_budget';break;}
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
  return {date,run,outcome,results,...(calendarError?{calendar_error:calendarError}:{})};
 }catch{
  try{await repo.finishRun(run,'failed','orchestration_failed',results);}catch{}
  throw Error('orchestration_failed');
 }
}
export function gamagoriRepository(db) {
 const checked=async p=>{const r=await p;if(r.error)throw Error('orchestrator_database_failed');return r.data;};
 return {
  prepare:(date,run)=>checked(db.rpc('bsc_gamagori_orchestrator_prepare',{p_date:date,p_run:run})),
  day:(date,status)=>checked(db.from('bsc_gamagori_collection_days').update({calendar_status:status,checked_at:new Date().toISOString()}).eq('race_date',date)),
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
