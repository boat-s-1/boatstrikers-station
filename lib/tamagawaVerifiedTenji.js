const clean=s=>String(s).replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();
const fail=error=>({ok:false,published:false,rows:[],error,source:'tamagawa_official_verified'});
const cells=row=>[...row.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
const headers=t=>[...(t.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1]||'').matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>clean(m[1])).join('|');
const tables=h=>[...h.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>m[0]);
const number=s=>/^\d{1,2}\.\d{2}$/.test(clean(s))?Number(clean(s)):null;
export function validTamagawaRace(r){return Number(r?.courseCode)===5&&Number.isInteger(Number(r?.raceNo))&&Number(r.raceNo)>=1&&Number(r.raceNo)<=12&&/^20\d{2}-\d{2}-\d{2}$/.test(r.raceDate||'')&&Number.isFinite(Date.parse(r.raceDate))&&new Date(r.raceDate).toISOString().slice(0,10)===r.raceDate;}

export function verifyTamagawa(original,reference,race){
 if(!validTamagawaRace(race))return fail('invalid_race');
 const day=race.raceDate.replaceAll('-',''),rn=Number(race.raceNo);
 if(!/<title[^>]*>\s*BOAT RACE 多摩川\s*<\/title>/.test(original)||!/<img[^>]*text_place2_05\.png[^>]*alt="多摩川"/.test(reference))return fail('source_venue_mismatch');
 // Verify the selected race link, not an arbitrary link in the 12-race menu.
 const selected=[...reference.matchAll(/<th\s*>\s*<a\s+href="([^"]+)"[^>]*>\s*\d+R\s*<\/a>\s*<\/th>/g)];
 if(selected.length!==1)return fail('reference_identity_missing');
 const u=new URL(selected[0][1].replaceAll('&amp;','&'),'https://www.boatrace.jp');
 if(u.origin!=='https://www.boatrace.jp'||u.pathname!=='/owpc/pc/race/beforeinfo'||u.searchParams.get('hd')!==day||u.searchParams.get('jcd')!=='05'||u.searchParams.get('rno')!==String(rn))return fail('reference_identity_mismatch');
 const active=reference.match(/<li class="is-active2">\s*<span class="tab2_inner">(\d+)月(\d+)日/);
 if(Number(active?.[1])!==Number(race.raceDate.slice(5,7))||Number(active?.[2])!==Number(race.raceDate.slice(8)))return fail('reference_date_mismatch');
 const displayed=original.match(/\$\("\.raceinfo_race",\s*parent\.document\)\.html\("(\d+)R"\)/);
 if(Number(displayed?.[1])!==rn)return fail('original_race_mismatch');
 if(/表示するデータがありません/.test(original))return fail('official_measurements_unavailable');
 const originalTables=tables(original).filter(t=>headers(t)==='枠|級別/登録番号 選手名 支部/出身地/年齢|体重|調整|チルト|展示|オリジナル展示データ|一周|まわり足|直線');
 const referenceTables=tables(reference).filter(t=>headers(t)==='枠|写真|ボートレーサー|体重|展示 タイム|チルト|プロペラ|部品交換|前走成績|調整重量');
 if(originalTables.length!==1||referenceTables.length!==1)return fail('timing_layout_changed');
 const rows=[];
 for(const m of originalTables[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const c=cells(m[1]);if(!c.length)continue;
  if(c.length!==9)return fail('original_row_changed');
  const boat=clean(c[0][2]),color=c[0][1].match(/\btei_color([1-6])\b/)?.[1];
  const ids=[...c[1][2].matchAll(/profile\?toban=(\d{4})/g)].map(m=>m[1]);
  if(!/^[1-6]$/.test(boat)||boat!==color||ids.length!==1)return fail('original_boat_identity_invalid');
  const [exhibitionTime,lapTime,turnTime,straightTime]=c.slice(5).map(c=>number(c[2]));
  if([exhibitionTime,lapTime,turnTime,straightTime].some(v=>v===null)||exhibitionTime<4||exhibitionTime>12||lapTime<25||lapTime>60||turnTime<2||turnTime>20||straightTime<2||straightTime>20)return fail('measurements_incomplete_or_invalid');
  rows.push({boatNo:Number(boat),racerNo:ids[0],exhibitionTime,lapTime,turnTime,straightTime});
 }
 const refs=[];
 for(const m of referenceTables[0].matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi)){
  const first=m[1].match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1]||'',c=cells(first);
  if(c.length!==10)return fail('reference_row_changed');
  const boat=clean(c[0][2]),color=c[0][1].match(/\bis-boatColor([1-6])\b/)?.[1];
  const ids=[...c[1][2].concat(c[2][2]).matchAll(/profile\?toban=(\d{4})/g)].map(m=>m[1]);
  if(!/^[1-6]$/.test(boat)||boat!==color||ids.length!==2||ids[0]!==ids[1])return fail('reference_boat_identity_invalid');
  refs.push({boatNo:Number(boat),racerNo:ids[0],exhibitionTime:number(c[4][2])});
 }
 if(rows.length!==6||refs.length!==6||new Set(rows.map(r=>r.boatNo)).size!==6||new Set(refs.map(r=>r.boatNo)).size!==6||new Set(rows.map(r=>r.racerNo)).size!==6)return fail('six_unique_boats_required');
 for(const row of rows){const ref=refs.find(r=>r.boatNo===row.boatNo);if(!ref||ref.racerNo!==row.racerNo||ref.exhibitionTime!==row.exhibitionTime)return fail('roster_or_exhibition_mismatch');}
 return {ok:true,published:true,source:'tamagawa_official_verified',rows:rows.sort((a,b)=>a.boatNo-b.boatNo),identity:{verified:true,courseCode:5,raceDate:race.raceDate,raceNo:rn,evidence:'official_selected_date_race_plus_six_boat_racer_and_exhibition_matches'},eligibleTheories:{ichika:true,hatsune:true,kiina:true}};
}
const cache=new Map();
export async function fetchTamagawaVerifiedTenji(race,options={}){
 if(!validTamagawaRace(race))return fail('invalid_race');
 const day=race.raceDate.replaceAll('-',''),rn=Number(race.raceNo),key=`${day}/${rn}`;
 const hit=cache.get(key);if(hit&&hit.until>Date.now())return structuredClone(hit.result);
 const url=`https://www.boatrace-tamagawa.com/modules/yosou/oriten.php?day=${day}&race=${rn}&jo=05&if=1`;
 const referenceUrl=`https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${rn}&jcd=05&hd=${day}`;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(12000,Math.max(1000,Number(options.timeoutMs)||10000)));
 const read=async target=>{
  const response=await fetch(target,{cache:'no-store',redirect:'manual',signal:controller.signal,headers:{'User-Agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)',Referer:new URL('/',target).href}});
  if(!response.ok){await response.body?.cancel();throw new Error('upstream_http_error');}
  const reader=response.body?.getReader();if(!reader)throw new Error('empty_body');
  const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();throw new Error('body_too_large');}chunks.push(value);}return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
 };
 try{
  const [original,reference]=await Promise.all([read(url),read(referenceUrl)]);
  const result={...verifyTamagawa(original,reference,race),url,referenceUrl,fetchedAt:new Date().toISOString()};
  if(result.ok){if(cache.size>=24)cache.delete(cache.keys().next().value);cache.set(key,{result:structuredClone(result),until:Date.now()+15000});}return result;
 }catch(e){return fail(e.name==='AbortError'?'upstream_timeout':['upstream_http_error','body_too_large','empty_body'].includes(e.message)?e.message:'upstream_fetch_failed');}finally{controller.abort();clearTimeout(timer);}
}
