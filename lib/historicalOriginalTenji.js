// Staging-only adapters. Candidate data must never be fed directly to alert RPCs.
const clean=s=>String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();
const cells=s=>[...s.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
const num=s=>/^\d{1,2}\.\d{2}$/.test(clean(s))?Number(clean(s)):null;
const fail=error=>({ok:false,parsed:false,notificationReady:false,rows:[],candidateRows:[],error});
export function validHistoricalRace(r){return [12,18,24].includes(Number(r?.courseCode))&&Number.isInteger(Number(r?.raceNo))&&Number(r.raceNo)>=1&&Number(r.raceNo)<=12&&/^20\d{2}-\d{2}-\d{2}$/.test(r.raceDate||'')&&Number.isFinite(Date.parse(r.raceDate))&&new Date(r.raceDate).toISOString().slice(0,10)===r.raceDate;}
function validate(rows,code){
 const key=code===24?'exhibitionCourse':'boatNo';
 if(rows.length!==6||new Set(rows.map(r=>r[key])).size!==6||rows.some(r=>!Number.isInteger(r[key])||r[key]<1||r[key]>6))return 'six_unique_entries_required';
 for(const r of rows){if(r.exhibitionTime===null||r.exhibitionTime<4||r.exhibitionTime>12||r.lapTime===null||r.lapTime<25||r.lapTime>60||r.turnTime===null||r.turnTime<2||r.turnTime>20||(code===24&&(r.straightTime===null||r.straightTime<2||r.straightTime>20)))return 'measurements_incomplete_or_invalid';}
 return null;
}
export function parseHistoricalOriginalTenji(html,race){
 if(!validHistoricalRace(race))return fail('invalid_race');
 const code=Number(race.courseCode),rn=Number(race.raceNo),day=race.raceDate.replaceAll('-','');
 let rows=[],evidence,blockers;
 if(code===12){
  const frames=[...html.matchAll(/<iframe\b[^>]*src=["']([^"']+)["']/gi)].map(m=>{try{return new URL(m[1].replaceAll('&amp;','&'));}catch{return null;}}).filter(u=>u?.origin==='https://front.player.boatrace-cdn.jp'&&u.pathname==='/player/vod'&&u.searchParams.get('raceType')==='exhibition');
  if(!frames.length)return fail('source_identity_missing');
  if(frames.some(u=>u.searchParams.get('stadium')!=='12suminoe'||u.searchParams.get('raceDate')!==day||u.searchParams.get('raceNumber')!==String(rn)))return fail('source_identity_mismatch');
  const tables=[...html.matchAll(/<table\b[^>]*id=["']tyokuzen04["'][^>]*>[\s\S]*?<\/table>/gi)];
  if(tables.length!==1)return fail('timing_table_ambiguous');
  const t=tables[0][0],head=t.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1]||'';
  if([...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>clean(m[1])).join('|')!=='枠|選手名|体重|チルト|展示|一周|まわり足|調整')return fail('timing_layout_changed');
  for(const m of t.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const c=cells(m[1]);if(c.length<=1)continue;if(c.length!==7)return fail('timing_row_changed');
   const boat=clean(c[0][2]),color=c[0][1].match(/\bwaku0([1-6])\b/)?.[1],ids=[...c[1][2].matchAll(/profile\?toban=(\d{4})/g)].map(m=>m[1]);
   if(!/^[1-6]$/.test(boat)||boat!==color||ids.length!==1)return fail('boat_identity_mismatch');
   rows.push({boatNo:Number(boat),racerNo:ids[0],exhibitionTime:num(c[4][2]),lapTime:num(c[5][2]),turnTime:num(c[6][2]),straightTime:null});
  }
  evidence='same_page_exhibition_replay_date_race_and_boat_cells';blockers=['live_update_verification_pending'];
 }else{
  const title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
  if(!title.includes(code===18?'徳山':'大村'))return fail('source_venue_mismatch');
  const date=clean(html).match(/(20\d{2})年(\d{2})月(\d{2})日/);
  if(!date||date.slice(1).join('')!==day)return fail('source_date_mismatch');
  if(code===18){
   const displayed=html.match(/<p>\s*(\d+)R[\s\u3000]/)?.[1];if(Number(displayed)!==rn)return fail('source_race_mismatch');
   const chunks=[...html.matchAll(/<div><span><a\b([^>]*)>([\s\S]*?)<\/a>([\s\S]*?)<\/div>/gi)];
   for(const m of chunks){
    const anchor=m[1].match(/href=['"]#([1-6])['"]/)?.[1],boat=m[2].match(/mb_tenjidata_no([1-6])\.gif/)?.[1];
    const text=clean(m[3]),racerNo=text.match(/^(\d{4})\s/)?.[1];
    if(!boat||anchor!==boat||!racerNo)return fail('boat_identity_mismatch');
    const value=label=>{const matches=[...text.matchAll(new RegExp(label+'：([^ ]+)','g'))];return matches.length===1?num(matches[0][1]):null;};
    rows.push({boatNo:Number(boat),racerNo,exhibitionTime:value('展示'),lapTime:value('一周'),turnTime:value('まわり足'),straightTime:null});
   }
   evidence='displayed_date_race_boat_image_and_anchor';blockers=['http_source_requires_independent_confirmation','live_update_verification_pending'];
  }else{
   const displayed=html.match(/<div class="tinymce">\s*20\d{2}年\d{2}月\d{2}日<br>\s*(\d+)R/)?.[1];if(Number(displayed)!==rn)return fail('source_race_mismatch');
   const tables=[...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>m[0]).filter(t=>/ｺｰｽ/.test(t)&&/一周/.test(t)&&/まわり足/.test(t)&&/直線/.test(t));
   if(tables.length!==1)return fail('timing_table_ambiguous');
   const t=tables[0],headerRows=[...t.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
   if(cells(headerRows[1]?.[1]||'').map(c=>clean(c[2])).join('|')!=='ST|展示 ﾀｲﾑ|一周|まわり足|直線|ｽﾀｰﾄ|展示 評価')return fail('timing_layout_changed');
   // The official markup labels this column COURSE. Never infer boatNo from position/color.
   for(const m of t.matchAll(/<td\b[^>]*rowspan=['"]2['"][^>]*>([1-6])<\/td>\s*<td\b[^>]*colspan=['"]7['"][^>]*>([\s\S]*?)<\/td>\s*<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const c=cells(m[3]);if(c.length!==7)return fail('timing_row_changed');
    const racerName=clean(m[2]);if(!racerName)return fail('racer_name_missing');
    rows.push({boatNo:null,exhibitionCourse:Number(m[1]),racerName,exhibitionTime:num(c[1][2]),lapTime:num(c[2][2]),turnTime:num(c[3][2]),straightTime:num(c[4][2])});
   }
   evidence='displayed_date_race_course_and_racer_name';blockers=['official_roster_boat_mapping_required','live_update_verification_pending'];
  }
 }
 const error=validate(rows,code);if(error)return fail(error);
 if(code!==24&&new Set(rows.map(r=>r.racerNo)).size!==6)return fail('duplicate_racer');
 return {ok:true,parsed:true,notificationReady:false,rows:[],candidateRows:rows,identity:{courseCode:code,raceDate:race.raceDate,raceNo:rn,evidence},blockingReasons:blockers,availableMetrics:code===24?['exhibition','lap','turn','straight']:['exhibition','lap','turn']};
}

export async function fetchHistoricalOriginalTenji(race){
 if(!validHistoricalRace(race))return fail('invalid_race');
 const code=Number(race.courseCode),rn=Number(race.raceNo),day=race.raceDate.replaceAll('-','');
 const url=code===12?`https://www.boatrace-suminoe.jp/asp/kyogi/12/sp/yoso05${String(rn).padStart(2,'0')}.htm`:code===18?`http://www.boatrace-tokuyama.jp/tenji-keisoku/m/?day=${day}&race=${rn}`:`https://omurakyotei.jp/yosou/m/chokuzen.php?day=${day}&race=${rn}`;
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),10000);
 try{
  const res=await fetch(url,{redirect:'manual',cache:'no-store',signal:control.signal,headers:{'User-Agent':'BoatStrikers-ExhibitionDiagnostic/1.0',Referer:new URL('/',url).href,'X-Requested-With':'XMLHttpRequest'}});
  if(!res.ok){await res.body?.cancel();return {...fail('upstream_http_error'),status:res.status};}
  const reader=res.body?.getReader();if(!reader)return fail('empty_body');const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();return fail('body_too_large');}chunks.push(value);}
  const html=new TextDecoder(code===12?'utf-8':'shift_jis').decode(Buffer.concat(chunks));
  return {...parseHistoricalOriginalTenji(html,race),sourceUrl:url,fetchedAt:new Date().toISOString()};
 }catch(e){return fail(e.name==='AbortError'?'upstream_timeout':'upstream_fetch_failed');}finally{clearTimeout(timer);}
}
