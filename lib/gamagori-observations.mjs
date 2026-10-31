import {createHash,randomUUID} from 'node:crypto';
import {validDate} from './gamagori-date.mjs';
import {verifyGamagoriProgram} from './gamagori-program-safety.mjs';
import {inspectGamagoriIndex,inspectGamagoriChoku,inspectOpenapiPreview,isGamagoriEntryBlocked} from './gamagori-source-audit.mjs';

const root='https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/';
export function gamagoriObservationUrls(date,race){
 if(!validDate(date)||!Number.isInteger(race)||race<1||race>12)throw Error('invalid_observation_identity');
 const day=date.replaceAll('-',''),r=String(race).padStart(2,'0');
 return {program:`${root}syusso/syusso${day}07${r}.htm`,index:`${root}index/index${day}07.htm`,choku:`${root}choku/choku${day}07${r}.htm`,openapi:'https://boatraceopenapi.github.io/api/v1/today.json'};
}
export function findGamagoriOpenapiRace(json,date,race){
 const p=json?.programs?.stadiums?.['7']?.races;if(!p||typeof p!=='object')return null;
 // The public API groups programs by stadium, then by race. Inspect only this bounded structure.
 const candidates=Object.values(p);
 const matches=candidates.filter(v=>v?.date===date&&v.stadium_number===7&&v.race_number===race);
 return matches.length===1?matches[0]:null;
}
export function validateGamagoriObservation({date,race,entries,deadline,documents,now=Date.now(),id=randomUUID()}){
 const urls=gamagoriObservationUrls(date,race),sources=Object.keys(urls).filter(k=>documents[k]).map(kind=>{
  const d=documents[kind];return {kind,url:urls[kind],html_sha256:d.html_sha256??null,http_status:d.http_status??null,received_at:d.received_at,http_date:d.http_date??null,age:d.age??null,error:d.error??null};
 });
 // On failure, boats hold only the expected DB roster. Never copy stale DB preview values.
 const expected=(entries??[]).slice(0,6).map(e=>({boat_no:e.boat_no,registration:Number(e.registration),exhibition_time:null,course:null}));
 const result={id,race_date:date,race_no:race,source:'gamagori_official_crosscheck_v1',source_url:urls.choku,html_sha256:documents.choku?.html_sha256??null,fetched_at:new Date(now).toISOString(),sources,boats:expected,validation_result:'unavailable',reason:'source_unavailable',sale_state:'unknown'};
 const finish=(validation_result,reason,sale_state=result.sale_state)=>({...result,validation_result,reason,sale_state});
 if(entries?.some(isGamagoriEntryBlocked))return finish('rejected','withdrawal_or_unknown_result_code','withdrawn');
 if(documents.index?.body){const s=inspectGamagoriIndex(documents.index.body,{date,race});if(['cancelled','postponed'].includes(s.state))return finish('rejected','official_cancellation',s.state);}
 if(sources.length!==4||sources.some(s=>s.http_status!==200||s.error))return finish('unavailable','source_unavailable');
 if(sources.some(s=>!(/^[a-f0-9]{64}$/).test(s.html_sha256??'')||!Number.isFinite(Date.parse(s.received_at))||now-Date.parse(s.received_at)>120000||Date.parse(s.received_at)>now||!Number.isFinite(Date.parse(s.http_date))||Math.abs(Date.parse(s.http_date)-Date.parse(s.received_at))>120000||!Number.isFinite(s.age)||s.age<0||s.age>60))return finish('rejected','response_stale_or_unverified');
 if(sources.some(s=>typeof documents[s.kind].body!=='string'||createHash('sha256').update(documents[s.kind].body).digest('hex')!==s.html_sha256))return finish('rejected','body_hash_mismatch');
 try{verifyGamagoriProgram(documents.program.body,{date,race,entries,deadline});}catch{return finish('rejected','program_identity_or_roster_mismatch');}
 const state=inspectGamagoriIndex(documents.index.body,{date,race});
 if(state.state!=='schedule_published')return finish('rejected','index_identity_unverified');
 let json;try{json=JSON.parse(documents.openapi.body);}catch{return finish('rejected','openapi_invalid');}
 const raw=findGamagoriOpenapiRace(json,date,race),upstream=inspectOpenapiPreview(raw,{date,raceNo:race,entries});
 const choku=inspectGamagoriChoku(documents.choku.body,{date,race,entries});
 if(upstream.state!=='six_preview_values'||choku.state!=='six_exhibition_times')return finish('rejected','six_boat_preview_unverified');
 const boats=Object.values(raw.preview.racers).map(b=>({boat_no:b.entry_number,registration:Number(entries.find(e=>e.boat_no===b.entry_number).registration),exhibition_time:Number(b.exhibition_time),course:b.course_number})).sort((a,b)=>a.boat_no-b.boat_no);
 if(boats.some(b=>choku.entries.find(e=>e.boat_no===b.boat_no)?.exhibition_time!==b.exhibition_time))return finish('rejected','official_upstream_exhibition_conflict');
 // checked_at is assigned by the DB only after this content verification and SQL guards.
 // There is no verified positive live-sale contract in v1; never return permission here.
 return {...result,boats,validation_result:'verified_content',reason:'content_verified_sale_unknown'};
}
export async function fetchGamagoriObservation({date,race,entries,deadline,fetcher=fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 const urls=gamagoriObservationUrls(date,race),documents={},end=now()+35000;
 if(entries?.some(isGamagoriEntryBlocked))return validateGamagoriObservation({date,race,entries,deadline,documents,now:now()});
 for(const [kind,url] of Object.entries(urls)){
  if(Object.keys(documents).length)await sleep(1500);
  if(now()+5000>end){documents[kind]={received_at:new Date(now()).toISOString(),error:'time_budget'};break;}
  try{
   const r=await fetcher(url,{signal:AbortSignal.timeout(5000),redirect:'error',cache:'no-store'}),metadata={http_status:r.status,http_date:r.headers.get('date'),age:Number(r.headers.get('age')??0)};
   if(!r.ok){await r.body?.cancel();documents[kind]={...metadata,received_at:new Date(now()).toISOString(),error:'http_error'};break;}
   const reader=r.body.getReader(),chunks=[];let bytes=0;
   while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>(kind==='openapi'?2000000:800000)){await reader.cancel();throw Error('document_too_large');}chunks.push(value);}
   const body=Buffer.concat(chunks),received_at=new Date(now()).toISOString();documents[kind]={...metadata,received_at,body:new TextDecoder().decode(body),html_sha256:createHash('sha256').update(body).digest('hex')};
   if(kind==='index'&&['cancelled','postponed'].includes(inspectGamagoriIndex(documents[kind].body,{date,race}).state))break;
  }catch(e){documents[kind]={received_at:new Date(now()).toISOString(),error:e.message==='document_too_large'?'document_too_large':'network_or_timeout'};break;}
 }
 return validateGamagoriObservation({date,race,entries,deadline,documents,now:now()});
}
export async function appendGamagoriObservation(db,observation){
 const {data,error}=await db.rpc('bsc_gamagori_record_observation',{p_observation:observation});
 if(error)throw Error('observation_persistence_failed');return data;
}
export function gamagoriObservationSummary(rows){
 const ordered=[...rows].sort((a,b)=>Date.parse(b.recorded_at)-Date.parse(a.recorded_at));
 return {latest:ordered[0]??null,last_content_checked_at:ordered.find(r=>r.checked_at)?.checked_at??null,collection_permitted:false,sale_contract:'unverified'};
}
