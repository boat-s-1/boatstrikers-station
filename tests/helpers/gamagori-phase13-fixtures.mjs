import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';
import {gamagoriObservationUrls} from '../../lib/gamagori-observations.mjs';import {jstDate} from '../../lib/gamagori-date.mjs';
export const published=JSON.parse(readFileSync(new URL('../fixtures/gamagori/official-published-expected-20261031-01.json',import.meta.url),'utf8')).boats;
// Synthetic SQL contract fixtures. Source hashes/clocks here are test metadata, not live proof.
export function observedSqlFixture(now=Date.now(),race=12){
 const date=jstDate(now),iso=new Date(now).toISOString(),urls=gamagoriObservationUrls(date,race),boats=published.map(({boat_no,registration,course,exhibition_time})=>({boat_no,registration,course,exhibition_time}));
 const observation={id:randomUUID(),race_date:date,race_no:race,source:'gamagori_official_crosscheck_v1',source_url:urls.choku,html_sha256:'a'.repeat(64),fetched_at:iso,sources:Object.entries(urls).map(([kind,url])=>({kind,url,html_sha256:'a'.repeat(64),http_status:200,received_at:iso,http_date:new Date(now).toUTCString(),age:0,error:null})),boats,validation_result:'verified_content',reason:'content_verified_sale_unknown',sale_state:'unknown',test_mode:'synthetic_sql_contract'};
 const row={race_no:race,boats:6,program:true,deadline:'23:59:00',status:'scheduled',cancel:null,finished:false,entries:boats.map(b=>({...b,registration:String(b.registration),preview_at:'2000-01-01T00:00:00Z'}))};
 const sale={state:'sale_open_observed',current_race:race,checked_race:race,race_from:race,deadline:'23:59',source_url:`https://www.boatrace.jp/owpc/pc/race/index?hd=${date.replaceAll('-','')}`,html_sha256:'b'.repeat(64),page_updated_at:new Date(Math.floor(now/60000)*60000).toISOString(),received_at:iso,http_date:new Date(now).toUTCString(),age:0,test_mode:'synthetic_sql_contract'};
 const chart={date,race,source_url:`https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/recomend/recomend${date.replaceAll('-','')}07${String(race).padStart(2,'0')}.htm`,html_sha256:'c'.repeat(64),received_at:iso,http_date:new Date(now).toUTCString(),age:0,boats:published};
 return {observation,row,evidence:{date,races:[row]},sale,chart};
}
