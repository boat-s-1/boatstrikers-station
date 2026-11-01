import {isGamagoriEntryBlocked} from './gamagori-source-audit.mjs';
import {jstDate} from './gamagori-date.mjs';
export const recent=(s,now)=>Number.isFinite(Date.parse(s))&&Date.parse(s)<=now+60000&&now-Date.parse(s)<=600000;
export const isRaceCancelled=r=>Boolean(r.cancel&&r.cancel!=='0')||/cancel|postpon|suspend|abort|中止|不成立|順延|延期/i.test(r.status??'');
export function databaseMeetingEvidence(evidence,date,now) {
 if(!evidence||evidence.date!==date)return {status:'unknown'};
 const races=evidence.races??[];
 const cancelled=isRaceCancelled;
 if(races.length&&races.every(cancelled))return {status:'cancelled',source:'database_cancellation'};
 const usable=races.filter(r=>!cancelled(r)&&r.boats===6&&r.program===true&&r.deadline&&!(r.entries??[]).some(isGamagoriEntryBlocked));
 if(date<jstDate(now)&&usable.some(r=>r.finished===true))return {status:'held',source:'db_historical_results',eligibleRaces:usable.map(r=>r.race_no),expiresAt:new Date(now+21600000).toISOString()};
 if(date!==jstDate(now)||!recent(evidence.live_sync,now))return {status:'unknown'};
 const fresh=usable.filter(r=>r.preview_boats===6&&recent(r.preview_at,now)&&recent(r.entry_preview_at,now)&&r.entries?.length===6&&new Set(r.entries.map(e=>e.boat_no)).size===6&&r.entries.every(e=>Number.isInteger(e.boat_no)&&e.boat_no>=1&&e.boat_no<=6)&&new Set(r.entries.map(e=>e.course)).size===6&&new Set(r.entries.map(e=>Number(e.registration))).size===6&&r.entries.every(e=>Number.isInteger(Number(e.registration))&&Number(e.registration)>=1000&&Number(e.registration)<=9999&&recent(e.preview_at,now)&&e.preview_source==='boatraceopenapi/v1'&&Number(e.exhibition_time)>=5&&Number(e.exhibition_time)<=10&&Number.isInteger(e.course)&&e.course>=1&&e.course<=6&&!/欠|中止|取消|順延|不成立|フライング|出遅れ|失格|\b[FLK]\b/i.test([e.result_code,e.result_note].filter(Boolean).join(' '))));
 if(!fresh.length)return {status:'unknown'};
 const expiry=Math.min(...fresh.flatMap(r=>[Date.parse(r.preview_at),Date.parse(r.entry_preview_at)]),Date.parse(evidence.live_sync))+600000;
 return {status:'held',source:'db_recent_preview',eligibleRaces:fresh.map(r=>r.race_no),expiresAt:new Date(expiry).toISOString()};
}

