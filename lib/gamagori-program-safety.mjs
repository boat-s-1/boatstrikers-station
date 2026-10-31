import {inspectGamagoriIndex} from './gamagori-source-audit.mjs';
import {createHash} from 'node:crypto';
export function verifyGamagoriProgram(html,{date,race,deadline,entries}) {
 const clean=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 if(!html.includes(`date${date.replaceAll('-','')}07.js`) || !new RegExp(`<option\\s+value=["']${race}R["'][^>]*\\bselected\\b`,'i').test(clean))throw Error('program_identity_mismatch');
 const time=clean.match(/<td\b[^>]*class=["']time["'][^>]*>\s*(\d{2}:\d{2})\s*<\/td>/i)?.[1];
 if(!time||time!==String(deadline??'').slice(0,5))throw Error('program_deadline_mismatch');
 // Conservative: any withdrawal/cancellation wording stops this race, including ambiguous history.
 if(/中止|順延|欠場|不成立|出走取消/.test(clean.replace(/<[^>]+>/g,' ')))throw Error('program_cancellation_or_absence');
 if(entries?.length!==6||new Set(entries.map(e=>e.boat_no)).size!==6)throw Error('program_roster_incomplete');
 const marks=[...clean.matchAll(/<td\b[^>]*class=["']n([1-6])\s+number\s+top_no_border["'][^>]*>\s*(\d{4})\s*\(/g)];
 const roster=new Map();for(const m of marks){const boat=Number(m[1]),id=Number(m[2]);if(roster.has(boat)&&roster.get(boat)!==id)throw Error('program_roster_conflict');roster.set(boat,id);}
 if(roster.size!==6||entries.some(e=>!Number.isInteger(e.boat_no)||e.boat_no<1||e.boat_no>6||roster.get(e.boat_no)!==Number(e.registration)))throw Error('program_roster_mismatch');
 return {source:'gamagori_official_program',html_sha256:createHash('sha256').update(html).digest('hex')};
}
export function verifyGamagoriStatus(text,context) {
 if(context){const state=inspectGamagoriIndex(text,context);if(['cancelled','postponed'].includes(state.state))throw Error('program_cancellation_or_absence');}
 else if(/中止|順延|欠場|不成立|出走取消/.test(text))throw Error('program_cancellation_or_absence');
 // A notice, timetable, odds pointer, or absent warning is not a verified live sale state.
 throw Error('program_status_unknown');
}
export async function loadGamagoriProgram({date,race,deadline,entries,deadlineAt},fetcher=fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))) {
 if(now()+6500>deadlineAt)throw Error('program_time_budget');
 const source=`https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/syusso/syusso${date.replaceAll('-','')}07${String(race).padStart(2,'0')}.htm`;
 let response;try{response=await fetcher(source,{signal:AbortSignal.timeout(5000),redirect:'error',cache:'no-store',headers:{'User-Agent':'BoatStrikers bounded official program safety check (boat-strike.online)'}});}catch{throw Error('program_network_or_timeout');}
 if(!response.ok){await response.body?.cancel();throw Error(`program_http_${response.status}`);}
 const responseTime=Date.parse(response.headers.get('date')),age=Number(response.headers.get('age')??0);
 if(!Number.isFinite(responseTime)||Math.abs(now()-responseTime)>120000||!Number.isFinite(age)||age<0||age>60){await response.body?.cancel();throw Error('program_response_stale');}
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>800000){await reader.cancel();throw Error('program_too_large');}chunks.push(value);}}catch(e){throw Error(e.message==='program_too_large'?e.message:'program_network_or_timeout');}
 const html=new TextDecoder().decode(Buffer.concat(chunks));
 verifyGamagoriProgram(html,{date,race,deadline,entries});
 if(now()+6000>deadlineAt)throw Error('program_time_budget');
 await sleep(1500);
 const statusSource=`https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/index/index${date.replaceAll('-','')}07.htm`;
 let statusResponse;try{statusResponse=await fetcher(statusSource,{signal:AbortSignal.timeout(4000),redirect:'error',cache:'no-store'});}catch{throw Error('program_status_network_or_timeout');}
 if(!statusResponse.ok){await statusResponse.body?.cancel();throw Error(`program_http_${statusResponse.status}`);}
 const statusDate=Date.parse(statusResponse.headers.get('date')),statusAge=Number(statusResponse.headers.get('age')??0);
 if(!Number.isFinite(statusDate)||Math.abs(now()-statusDate)>120000||!Number.isFinite(statusAge)||statusAge<0||statusAge>60){await statusResponse.body?.cancel();throw Error('program_response_stale');}
 const sr=statusResponse.body.getReader();let sb=0;const sc=[];
 try{while(true){const {done,value}=await sr.read();if(done)break;sb+=value.byteLength;if(sb>400000){await sr.cancel();throw Error('program_too_large');}sc.push(value);}}catch(e){throw Error(e.message==='program_too_large'?e.message:'program_status_network_or_timeout');}
 const statusText=new TextDecoder().decode(Buffer.concat(sc));verifyGamagoriStatus(statusText,{date,race});
}
