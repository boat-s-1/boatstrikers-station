import {jstDate,validDate} from './gamagori-date.mjs';
// Read-only candidate proof. This is not wired into collection authorization.
export function inspectBoatraceSaleStatus({html,date,race,received_at,http_date,age=0,now=Date.now()}){
 const unknown=reason=>({state:'unknown',reason,collection_permitted:false});
 if(!validDate(date)||!Number.isInteger(race)||race<1||race>12)return unknown('identity_invalid');
 const s=String(html??'').replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 const day=date.replaceAll('-','');
 if(!new RegExp(`class=["']btnGroup3_refreshBtn["'][^>]*>\\s*<a[^>]*href=["']/owpc/pc/race/index\\?hd=${day}["']`).test(s))return unknown('page_date_unverified');
 const groups=[...s.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi)].map(m=>m[1]).filter(b=>/text_place1_07\.png/.test(b));
 if(groups.length!==1)return unknown('stadium_row_unverified');
 const row=groups[0];
 if(!row.includes(`/owpc/pc/race/raceindex?jcd=07&amp;hd=${day}`))return unknown('stadium_date_unverified');
 const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
 if(/中止|順延|不成立/.test(cells[1]??''))return {state:'cancelled_or_postponed',collection_permitted:false};
 const open=cells[1]?.match(/^([1-9]|1[0-2])R以降 発売中$/);
 if(!open||race<Number(open[1]))return unknown('target_sale_not_explicit');
 const time=s.match(/class=["']btnGroup3_log["'][^>]*>\s*更新時間\s+(\d{2}:\d{2})\s*<\/p>/)?.[1];
 const updated=Date.parse(`${date}T${time}:00+09:00`),received=Date.parse(received_at),http=Date.parse(http_date);
 if(jstDate(now)!==date||![updated,received,http].every(Number.isFinite)||now-updated<0||now-updated>120000||now-received<0||now-received>120000||Math.abs(http-received)>120000||!Number.isFinite(age)||age<0||age>60)return unknown('sale_freshness_unverified');
 return {state:'sale_open_observed',race_from:Number(open[1]),page_updated_at:new Date(updated).toISOString(),checked_race:race,collection_permitted:false,limitation:'venue_sale_display_is_not_six_boat_or_no_withdrawal_proof'};
}
