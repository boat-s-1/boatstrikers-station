import {createHash,randomUUID} from 'node:crypto';
import {fetchGamagoriObservation,appendGamagoriObservation,gamagoriObservationUrls} from './gamagori-observations.mjs';
import {inspectBoatraceSaleStatus} from './gamagori-sale-audit.mjs';
import {verifyObservedGamagoriChart} from './gamagori-chart-identity.mjs';
import {isGamagoriEntryBlocked} from './gamagori-source-audit.mjs';
import {isRaceCancelled} from './gamagori-meeting-policy.mjs';
const fresh=(s,now)=>Number.isFinite(Date.parse(s))&&Date.parse(s)<=now+1000&&now-Date.parse(s)<=120000;
export function verifiedObservationProof(o,{date,race,entries,now}){
 if(!o||o.race_date!==date||o.race_no!==race||o.stadium_number!==7||o.validation_result!=='verified_content'||o.sale_state!=='unknown'||!fresh(o.checked_at,now)||!fresh(o.fetched_at,now)||o.source!=='gamagori_official_crosscheck_v1'||o.source_url!==gamagoriObservationUrls(date,race).choku)return false;
 const b=o.boats;if(b?.length!==6||entries?.length!==6||entries.some(isGamagoriEntryBlocked)||new Set(b.map(x=>x.boat_no)).size!==6||new Set(b.map(x=>x.registration)).size!==6||new Set(b.map(x=>x.course)).size!==6)return false;
 return b.every(x=>Number.isInteger(x.boat_no)&&x.boat_no>=1&&x.boat_no<=6&&Number.isInteger(x.registration)&&x.registration>=1000&&x.registration<=9999&&Number.isInteger(x.course)&&x.course>=1&&x.course<=6&&Number.isFinite(x.exhibition_time)&&x.exhibition_time>=5&&x.exhibition_time<=10&&entries.some(e=>e.boat_no===x.boat_no&&Number(e.registration)===x.registration));
}
export async function readObservedDocument(url,{fetcher,now,deadlineAt,limit=400000}){
 if(now()+5000>deadlineAt)throw Error('observed_time_budget');
 const r=await fetcher(url,{signal:AbortSignal.timeout(5000),redirect:'error',cache:'no-store'});
 if(!r.ok){await r.body?.cancel();throw Error(`observed_http_${r.status}`);}
 const chunks=[],reader=r.body.getReader();let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('observed_document_too_large');}chunks.push(value);}
 const received_at=new Date(now()).toISOString(),http_date=r.headers.get('date'),age=Number(r.headers.get('age')??0),bytes=Buffer.concat(chunks);
 if(!fresh(http_date,now())||Math.abs(now()-Date.parse(http_date))>120000||!Number.isFinite(age)||age<0||age>60)throw Error('observed_response_stale');
 return {html:new TextDecoder().decode(bytes),source_url:url,html_sha256:createHash('sha256').update(bytes).digest('hex'),received_at,http_date,age};
}
export async function collectObservedCharts({db,parse,date,first,limit=3,fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,deadlineAt=now()+38000,capture=fetchGamagoriObservation}){
 if(!Number.isInteger(first)||first<1||first>12||!Number.isInteger(limit)||limit<1||limit>3)throw Error('invalid_batch');
 const results=[],end=Math.min(first+limit-1,12),deadline=Math.min(now()+38000,deadlineAt);
 const rpc=async(name,args)=>{const r=await db.rpc(name,args);if(r.error)throw Error('observed_database_unavailable');return r.data;};
 for(let race=first;race<=end;race++){
  let attempts=0,observation;
  const block=reason=>results.push({race,status:'blocked_safety',reason,upstream_attempts:attempts});
  const invalidate=async reason=>{
   if(!observation)return;
   await appendGamagoriObservation(db,{...observation,id:randomUUID(),fetched_at:new Date(now()).toISOString(),validation_result:'rejected',reason,sale_state:'unknown',boats:observation.boats.map(b=>({...b,exhibition_time:null,course:null}))});
  };
  try{
   const existing=await db.from('bsc_gamagori_chart_ratings').select('boat_no').eq('race_date',date).eq('race_no',race);
   if(existing.error)throw Error('observed_database_unavailable');
   if(existing.data?.length){results.push({race,status:existing.data.length===6&&new Set(existing.data.map(b=>b.boat_no)).size===6?'skipped_existing':'blocked_partial_existing',upstream_attempts:0});continue;}
   const evidence=await rpc('bsc_gamagori_meeting_evidence',{p_date:date}),row=evidence?.races?.find(r=>r.race_no===race);
   if(evidence?.date!==date||!row||row.program!==true||row.entries?.length!==6||!['scheduled','racing'].includes(row.status)||isRaceCancelled(row)||row.entries.some(isGamagoriEntryBlocked)){block('observed_event_unverified');continue;}
   if(!row.deadline||now()>=Date.parse(`${date}T${row.deadline}+09:00`)){block('observed_deadline_closed');continue;}
   observation=await capture({date,race,entries:row.entries,deadline:row.deadline,fetcher,now,sleep,deadlineAt:deadline-15000});
   await appendGamagoriObservation(db,observation);
   let latest=await rpc('bsc_gamagori_latest_observation',{p_date:date,p_race:race});
   if(latest?.id!==observation.id||!verifiedObservationProof(latest,{date,race,entries:row.entries,now:now()})){block('observed_latest_not_verified');break;}
   await sleep(1500);
   const saleDoc=await readObservedDocument(`https://www.boatrace.jp/owpc/pc/race/index?hd=${date.replaceAll('-','')}`,{fetcher,now,deadlineAt:deadline});
   const sale={...inspectBoatraceSaleStatus({...saleDoc,date,race,now:now(),strictRace:true}),...saleDoc};delete sale.html;
   if(sale.state!=='sale_open_observed'||sale.deadline!==row.deadline.slice(0,5)){await invalidate('sale_unverified');block('observed_sale_unverified');break;}
   const url=`https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/recomend/recomend${date.replaceAll('-','')}07${String(race).padStart(2,'0')}.htm`;
   let chart;for(let attempt=0;attempt<2;attempt++){
    await sleep(1500);attempts++;
    try{chart=await readObservedDocument(url,{fetcher,now,deadlineAt:deadline});break;}catch(e){if(attempt===1||/^observed_http_(?:4\d\d)$/.test(e.message)||['observed_time_budget','observed_document_too_large','observed_response_stale'].includes(e.message))throw e;}
   }
   const boats=verifyObservedGamagoriChart(chart.html,{date,race,observation:latest,parse});delete chart.html;
   latest=await rpc('bsc_gamagori_latest_observation',{p_date:date,p_race:race});
   if(latest?.id!==observation.id||!verifiedObservationProof(latest,{date,race,entries:row.entries,now:now()})){await invalidate('latest_observation_changed');block('observed_latest_changed');break;}
   const saved=await rpc('bsc_gamagori_save_observed_chart',{p_observation:observation.id,p_sale:sale,p_chart:{...chart,date,race,boats}});
   results.push({race,...saved,upstream_attempts:attempts});
   if(!['saved','skipped_existing'].includes(saved.status))break;
  }catch(e){
   const reason=/^(?:observed_[a-z_0-9]+|chart_[a-z_]+)$/.test(e.message)?e.message:'observed_source_or_validation_failed';
   try{await invalidate(reason);}catch{}
   block(reason);break;
  }
 }
 return {date,results,nextRace:end<12?end+1:null};
}
