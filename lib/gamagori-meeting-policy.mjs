import {jstDate} from './gamagori-date.mjs';
const recent=(s,now)=>Number.isFinite(Date.parse(s))&&Date.parse(s)<=now+60000&&now-Date.parse(s)<=600000;
export const isRaceCancelled=r=>Boolean(r.cancel&&r.cancel!=='0')||/cancel|中止|不成立/i.test(r.status??'');
export function databaseMeetingEvidence(evidence,date,now) {
 if(!evidence||evidence.date!==date)return {status:'unknown'};
 const races=evidence.races??[];
 const cancelled=isRaceCancelled;
 if(races.length&&races.every(cancelled))return {status:'cancelled',source:'database_cancellation'};
 const usable=races.filter(r=>!cancelled(r)&&r.boats===6&&r.program===true&&r.deadline);
 if(date<jstDate(now)&&usable.some(r=>r.finished===true))return {status:'held',source:'db_historical_results',eligibleRaces:usable.map(r=>r.race_no),expiresAt:new Date(now+21600000).toISOString()};
 if(date!==jstDate(now)||!recent(evidence.live_sync,now))return {status:'unknown'};
 const fresh=usable.filter(r=>r.preview_boats===6&&recent(r.preview_at,now)&&recent(r.entry_preview_at,now));
 if(!fresh.length)return {status:'unknown'};
 const expiry=Math.min(...fresh.flatMap(r=>[Date.parse(r.preview_at),Date.parse(r.entry_preview_at)]),Date.parse(evidence.live_sync))+600000;
 return {status:'held',source:'db_recent_preview',eligibleRaces:fresh.map(r=>r.race_no),expiresAt:new Date(expiry).toISOString()};
}
