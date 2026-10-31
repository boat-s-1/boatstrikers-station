const recent=(s,now)=>Number.isFinite(Date.parse(s))&&Date.parse(s)<=now+60000&&now-Date.parse(s)<=600000;
const visible=s=>String(s??'').replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ');
export function isGamagoriEntryBlocked(entry) {
 const code=String(entry.result_code??'').trim();
 // Actual stored normal codes are 01..06. K0/K1 are withdrawals; unknown codes also stop.
 return Boolean(code&&!/^0?[1-6]$/.test(code))||/欠|中止|取消|順延|不成立|フライング|出遅れ|失格|返還|\b[FLK]\d*\b/i.test(String(entry.result_note??''));
}
export function inspectGamagoriIndex(html,{date,race}) {
 const clean=String(html??'').replace(/<!--[\s\S]*?-->/g,'');
 const dates=[...clean.matchAll(/<script\b[^>]*src=["'][^"']*\/date(\d{8})07\.js(?:\?[^"']*)?["']/gi)].map(m=>m[1]);
 if(!dates.length||dates.some(d=>d!==date.replaceAll('-','')))return {state:'unknown',reason:'index_date_unverified',collection_permitted:false};
 const p=[...clean.matchAll(/<p\b[^>]*class=["'][^"']*\bcyushi\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi)].map(m=>visible(m[1])).join(' ');
 if(/中止|順延|不成立/.test(p))return {state:/順延/.test(p)?'postponed':'cancelled',reason:'official_index_explicit_cancellation',collection_permitted:false};
 const target=`syusso${date.replaceAll('-','')}07${String(race).padStart(2,'0')}.htm`;
 if(![...clean.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].some(m=>m[1].endsWith('/'+target)))return {state:'unknown',reason:'index_race_unverified',collection_permitted:false};
 return {state:'schedule_published',sale_state:'unknown',reason:'schedule_is_not_live_sale_status',collection_permitted:false};
}
export function inspectGamagoriNavigation(js) {
 const s=String(js??'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\r\n]*/g,'');
 const target=s.match(/function\s+funcTargetDate2\s*\(\s*\)\s*\{\s*return\s+["'](\d{8})["']\s*;?\s*\}/)?.[1]??null;
 const pointer=(name,variable)=>{const m=s.match(new RegExp(`function\\s+${name}\\s*\\(\\s*\\)\\s*\\{\\s*var\\s+${variable}\\s*=\\s*(\\d+)\\s*;\\s*return\\s+${variable}\\s*;?\\s*\\}`));return m&&Number(m[1])<=12?Number(m[1]):null;};
 return {target_date:target,latest_odds_race:pointer('funcOddsRacenum','strOddsRaceNum'),latest_result_race:pointer('funckekkaRacenum','strKekkaRaceNum'),collection_permitted:false};
}
export function inspectOpenapiPreview(race,{date,raceNo,entries}) {
 const p=race?.preview;
 if(race?.date!==date||race?.stadium_number!==7||race?.race_number!==raceNo||p?.date!==date||p?.stadium_number!==7||p?.race_number!==raceNo)return {state:'identity_unverified',collection_permitted:false};
 const roster=Object.values(race.racers??{}),boats=Object.values(p.racers??{});
 if(entries?.length!==6||new Set(entries.map(e=>e.boat_no)).size!==6||roster.length!==6||new Set(roster.map(r=>r.entry_number)).size!==6||roster.some(r=>!entries.some(e=>e.boat_no===r.entry_number&&Number(e.registration)===Number(r.number))))return {state:'roster_mismatch',collection_permitted:false};
 if(boats.length!==6||new Set(boats.map(b=>b.entry_number)).size!==6||boats.some(b=>!Number.isInteger(b.entry_number)||b.entry_number<1||b.entry_number>6))return {state:'preview_slots_incomplete',collection_permitted:false};
 const input=boats.filter(b=>['exhibition_time','start_timing','course_number','tilt_adjustment'].some(k=>b[k]!==null&&b[k]!==undefined));
 const complete=boats.filter(b=>b.exhibition_time!==null&&Number.isFinite(Number(b.exhibition_time))&&Number(b.exhibition_time)>=5&&Number(b.exhibition_time)<=10&&Number.isInteger(b.course_number)&&b.course_number>=1&&b.course_number<=6);
 return {state:input.length===0?'empty_preview_shell':complete.length===6&&new Set(complete.map(b=>b.course_number)).size===6?'six_preview_values':'partial_preview',preview_slots:boats.length,sync_input_rows:input.length,complete_preview_values:complete.length,per_race_updated_at:null,collection_permitted:false};
}
export function inspectGamagoriChoku(html,{date,race,entries}) {
 const original=String(html??''),clean=original.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 const days=[...original.matchAll(/<script\b[^>]*src=["'][^"']*\/KekkaRaceNum(\d{8})07\.js(?:\?[^"']*)?["']/gi)].map(m=>m[1]);
 if(!days.length||days.some(d=>d!==date.replaceAll('-',''))||!new RegExp(`<option\\s+value=["']${race}R["'][^>]*\\bselected\\b`,'i').test(clean))return {state:'identity_unverified',collection_permitted:false};
 const rows=[...clean.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]),boats=new Map();
 for(let i=0;i<rows.length;i++){
  if(!/class=["']cho_time["']/.test(rows[i]))continue;
  const boat=rows[i].match(/<td\b[^>]*class=["'][^"']*\bcho_waku\s+r([1-6])\b[^"']*["']/i)?.[1];if(!boat)continue;
  const time=visible(rows[i].match(/<td\b[^>]*class=["']cho_time["'][^>]*>([\s\S]*?)<\/td>/i)?.[1]).trim();
  const reg=(rows[i+1]??'').match(new RegExp(`class=["']n${boat}\\s+cho_number\\s+top_no_border["'][^>]*>\\s*(\\d{4})\\s*\\(`,'i'))?.[1];
  if(!reg)return {state:'roster_incomplete',collection_permitted:false};
  const record={boat_no:Number(boat),registration:reg,exhibition_time:/^\d+\.\d+$/.test(time)&&Number(time)>=5&&Number(time)<=10?Number(time):null};
  if(boats.has(record.boat_no)&&JSON.stringify(boats.get(record.boat_no))!==JSON.stringify(record))return {state:'conflicting_preview_copies',collection_permitted:false};
  boats.set(record.boat_no,record);
 }
 const values=[...boats.values()].sort((a,b)=>a.boat_no-b.boat_no);
 if(values.length!==6||entries?.length!==6||values.some(v=>!entries.some(e=>e.boat_no===v.boat_no&&Number(e.registration)===Number(v.registration))))return {state:'roster_mismatch',collection_permitted:false};
 const count=values.filter(v=>v.exhibition_time!==null).length;
 return {state:count===0?'no_exhibition_values':count===6?'six_exhibition_times':'partial_exhibition_values',exhibition_time_count:count,entries:values,collection_permitted:false};
}
export function describeGamagoriDatabasePreview(evidence,date,now) {
 return {race_date:date,clock_semantics:{api_preview_synced_at:'last_value_change_for_entries; not last successful observation',event_preview_synced_at:'successful application time, including empty preview object',live_sync:'whole-file job success; not per-race coverage'},live_job_recent:recent(evidence?.live_sync,now),collection_permitted:false,races:(evidence?.races??[]).map(r=>{
  const entries=r.entries??[],values=entries.filter(e=>e.exhibition_time!==null&&Number.isFinite(Number(e.exhibition_time))&&Number(e.exhibition_time)>=5&&Number(e.exhibition_time)<=10&&Number.isInteger(e.course)&&e.course>=1&&e.course<=6),blocked=entries.filter(isGamagoriEntryBlocked);
  const changed=entries.map(e=>Date.parse(e.preview_at)).filter(Number.isFinite);
  return {race_no:r.race_no,roster_rows:entries.length,preview_value_rows:values.length,blocked_boats:blocked.map(e=>e.boat_no),last_value_change_min:changed.length?new Date(Math.min(...changed)).toISOString():null,last_observed_at:null,diagnosis:blocked.length?'withdrawal_or_unknown_result_code':values.length!==6?'preview_values_missing':entries.every(e=>recent(e.preview_at,now))?'recent_value_changes_only':'observation_time_not_available'};
 })};
}
