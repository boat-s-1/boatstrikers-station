import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=name=>readFileSync(new URL('../fixtures/gamagori/'+name,import.meta.url),'utf8');
// Derived completion of real 2026-10-31 fixtures; NOT an observed published preview.
export function observationFixture(now=Date.now(),complete=true){
 const raw=JSON.parse(read('openapi-empty-preview-20261031-01.json'));
 if(complete)for(const [key,b] of Object.entries(raw.race.preview.racers)){b.exhibition_time=6.8;b.course_number=Number(key);}
 let choku=read('official-choku-20261031-01.html');if(complete)choku=choku.replaceAll('<td class="cho_time"></td>','<td class="cho_time">6.8</td>');
 const bodies={program:read('program-20261031-01.html'),index:read('official-index-20261031.html'),choku,openapi:JSON.stringify({programs:{stadiums:{'7':{races:{'1':raw.race}}}}})};
 const documents=Object.fromEntries(Object.entries(bodies).map(([kind,body])=>[kind,{body,http_status:200,received_at:new Date(now).toISOString(),http_date:new Date(now).toUTCString(),age:0,html_sha256:createHash('sha256').update(body).digest('hex')}]));
 return {date:'2026-10-31',race:1,deadline:'15:21:00',entries:raw.db_entries,documents,now};
}
export const officialFixture=read;
