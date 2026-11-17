// Archived, read-only source classification. No DB client, writes, live authorization or JS evaluation.
import {readFileSync,writeFileSync} from 'node:fs';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {gamagoriObservationUrls,findGamagoriOpenapiRace,validateGamagoriObservation} from '../lib/gamagori-observations.mjs';
import {inspectBoatraceSaleStatus} from '../lib/gamagori-sale-audit.mjs';import {verifyObservedGamagoriChart} from '../lib/gamagori-chart-identity.mjs';import {parseGamagoriChart} from '../lib/gamagori-chart-parser.ts';
const args=Object.fromEntries(process.argv.slice(2).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];})),date=args['--date']??'2026-10-31',race=Number(args['--race']??1),dir=args['--dir'];
if(!dir||!args['--output'])throw Error('required --dir=PATH --output=PATH');gamagoriObservationUrls(date,race);
const manifests=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8')),documents={};
for(const m of manifests){if(m.error)continue;const bytes=readFileSync(join(dir,m.kind+'.txt'));if(createHash('sha256').update(bytes).digest('hex')!==m.html_sha256)throw Error('archive_hash_mismatch');documents[m.kind]={...m,body:new TextDecoder().decode(bytes)};}
const raw=findGamagoriOpenapiRace(JSON.parse(documents.openapi.body),date,race),entries=Object.values(raw.racers).map(r=>({boat_no:r.entry_number,registration:r.number})),now=Math.max(...manifests.filter(m=>m.received_at).map(m=>Date.parse(m.received_at)));
const deadline=String(raw.closed_at).split(' ')[1],observation=validateGamagoriObservation({date,race,entries,deadline,documents,now});
let chart;try{chart={state:'six_way_identity_matched',boats:verifyObservedGamagoriChart(documents.chart.body,{date,race,observation,parse:parseGamagoriChart})};}catch(e){chart={state:'unverified',reason:/^chart_[a-z_]+$/.test(e.message)?e.message:'chart_unverified'};}
const sale=inspectBoatraceSaleStatus({...documents.sale,html:documents.sale.body,date,race,now,strictRace:true});
const output={mode:'ARCHIVED_READ_ONLY_CAPTURE_TIMESTAMP_REPLAY',date,race,captured_at:new Date(now).toISOString(),sources:manifests,content:{validation_result:observation.validation_result,reason:observation.reason,boats:observation.boats},sale,chart,chart_saves:0,database_writes:0,collection_permitted:false};
writeFileSync(args['--output'],JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({content:observation.validation_result,chart:chart.state,sale:sale.state,collection_permitted:false}));
