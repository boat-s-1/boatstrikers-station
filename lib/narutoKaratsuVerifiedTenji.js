const clean = s => String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();
const fail = error => ({ok:false,published:false,rows:[],error});
const attr = (tag,key) => tag.match(new RegExp(`\\b${key}\\s*=\\s*["']([^"']*)["']`,'i'))?.[1];
export function validVerifiedRace(race) {
  return [14,23].includes(Number(race?.courseCode)) && Number.isInteger(Number(race?.raceNo)) &&
    Number(race.raceNo)>=1 && Number(race.raceNo)<=12 && /^20\d{2}-\d{2}-\d{2}$/.test(race.raceDate||'') &&
    Number.isFinite(Date.parse(race.raceDate)) && new Date(race.raceDate).toISOString().slice(0,10)===race.raceDate;
}
export function parseNarutoKaratsu(html,race,now=new Date()) {
  if(!validVerifiedRace(race))return fail('invalid_race');
  const code=Number(race.courseCode), day=race.raceDate.replaceAll('-',''), rn=Number(race.raceNo);
  const title=clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
  if(!title.includes(code===14?'鳴門':'からつ'))return fail('source_venue_mismatch');
  let evidence;
  if(code===14){
    const selected=[...html.matchAll(/<li\b[^>]*class=["'][^"']*\bselected\b[^"']*["'][^>]*>[\s\S]*?<\/li>/gi)]
      .map(m=>m[0]).filter(t=>/オリジナル/.test(clean(t)));
    if(selected.length!==1)return fail('source_identity_missing');
    const tag=selected[0].match(/<a\b[^>]*>/i)?.[0]||'';
    if(attr(tag,'data-day')!==day || attr(tag,'data-race')!==String(rn) || attr(tag,'data-kind')!=='2')return fail('source_identity_mismatch');
    const displayed=html.match(/\$\("\.race_number",\s*parent\.document\)\.html\("(\d+)R"\)/);
    if(Number(displayed?.[1])!==rn)return fail('source_race_mismatch');
    evidence='selected_original_tab_date_and_displayed_race';
  }else{
    // Current-day-only endpoint: require calendar selection AND dated content,
    // not just the date requested by the caller or today's server clock.
    if(race.raceDate!==now.toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}))return fail('current_day_only');
    const month=html.match(/<dt\b[^>]*class=["']schedule-area__month["'][^>]*>\s*(\d+)\s*\//)?.[1];
    const selected=html.match(/<dd\b[^>]*class=["'][^"']*schedule-area__days[^"']*\bcurrent\b[^"']*["'][^>]*>\s*<span\b[^>]*class=["']item-day["'][^>]*>(\d+)</)?.[1];
    const display=html.match(/<div\b[^>]*class=["']select_race_display["'][^>]*>(\d+)R<\//)?.[1];
    const dates=[...html.matchAll(/<p\b[^>]*class=["']item-date["'][^>]*>(\d{4}\/\d{2}\/\d{2})<\/p>/g)].map(m=>m[1].replaceAll('/','-'));
    if(Number(month)!==Number(race.raceDate.slice(5,7)) || Number(selected)!==Number(race.raceDate.slice(8)) || Number(display)!==rn || dates.filter(d=>d===race.raceDate).length<6 || dates.some(d=>d>race.raceDate))return fail('source_identity_mismatch');
    evidence='current_calendar_displayed_race_and_six_dated_comments';
  }
  const candidates=[...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>m[0]).filter(t=>{
    const head=clean(t.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1]||'');
    return head.includes('一周')&&head.includes('まわり足')&&head.includes('直線');
  });
  if(candidates.length!==1)return fail('timing_table_ambiguous');
  const table=candidates[0], head=table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1]||'';
  const headers=[...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>clean(m[1])).join('|');
  const expected=code===14?'枠|級別/登録番号 選手名 支部/出身地/年齢|体重|チルト|各タイム|調整|展示|一周|まわり足|直線':'枠|体重|チルト|展示|オリジナル展示データ|展示 評価|調整|一周|まわり足|直線';
  if(headers!==expected)return fail('timing_layout_changed');
  const rows=[];
  for(const m of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...m[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
    if(cells.length<=1)continue;
    if(cells.length!==8)return fail('timing_row_changed');
    const boat=clean(cells[0][2]), color=cells[0][1].match(/\btei_color([1-6])\b/)?.[1];
    if(!/^[1-6]$/.test(boat)||color!==boat)return fail('boat_identity_mismatch');
    const start=code===14?4:3;
    const values=cells.slice(start,start+4).map(c=>clean(c[2])).map(v=>/^\d{1,2}\.\d{2}$/.test(v)?Number(v):null);
    const [exhibitionTime,lapTime,turnTime,straightTime]=values;
    if(values.some(v=>v===null)||exhibitionTime<4||exhibitionTime>12||lapTime<25||lapTime>60||turnTime<2||turnTime>20||straightTime<2||straightTime>20)return fail('measurements_incomplete_or_invalid');
    rows.push({boatNo:Number(boat),exhibitionTime,lapTime,turnTime,straightTime});
  }
  if(rows.length!==6||new Set(rows.map(r=>r.boatNo)).size!==6)return fail('six_unique_boats_required');
  return {ok:true,published:true,rows:rows.sort((a,b)=>a.boatNo-b.boatNo),identity:{verified:true,courseCode:code,raceDate:race.raceDate,raceNo:rn,evidence},eligibleTheories:{ichika:true,hatsune:true,kiina:true}};
}
const cache=new Map();
export async function fetchNarutoKaratsu(race,options={}){
  if(!validVerifiedRace(race))return fail('invalid_race');
  const code=Number(race.courseCode),name=code===14?'naruto':'karatsu',key=`${code}/${race.raceDate}/${Number(race.raceNo)}`;
  if(code===23&&race.raceDate!==new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}))return fail('current_day_only');
  const cached=cache.get(key);if(cached&&cached.until>Date.now())return structuredClone(cached.result);
  const url=code===14?`https://www.n14.jp/modules/yosou/group-cyokuzen.php?day=${race.raceDate.replaceAll('-','')}&race=${Number(race.raceNo)}&kind=2&if=1`:`https://www.boatrace-karatsu.jp/sp/index.php?page=yosou-cyokuzen&race=${Number(race.raceNo)}`;
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),Math.min(10000,Math.max(1000,Number(options.timeoutMs)||7000)));
  try{
    const res=await fetch(url,{redirect:'manual',cache:'no-store',signal:abort.signal,headers:{'User-Agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)','X-Requested-With':'XMLHttpRequest',Referer:new URL('/',url).href}});
    if(!res.ok){await res.body?.cancel();return {...fail('upstream_http_error'),status:res.status};}
    const reader=res.body?.getReader();if(!reader)return fail('empty_body');
    const chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();return fail('body_too_large');}chunks.push(value);}
    const result={...parseNarutoKaratsu(new TextDecoder('utf-8').decode(Buffer.concat(chunks)),race),source:`${name}_official_verified`,url,fetchedAt:new Date().toISOString()};
    if(result.ok){if(cache.size>=24)cache.delete(cache.keys().next().value);cache.set(key,{result:structuredClone(result),until:Date.now()+15000});}return result;
  }catch(e){return fail(e.name==='AbortError'?'upstream_timeout':'upstream_fetch_failed');}finally{clearTimeout(timer);}
}
