import test from 'node:test';import assert from 'node:assert/strict';
import {databaseMeetingEvidence} from './gamagori-meeting-policy.mjs';
const date='2026-10-31',now=Date.parse(date+'T15:00:00+09:00');
const iso=new Date(now-60000).toISOString();
const evidence=()=>({date,live_sync:iso,races:[{race_no:1,program:true,boats:6,preview_boats:6,deadline:'15:20:00',preview_at:iso,entry_preview_at:iso,status:'scheduled',cancel:null,entries:Array.from({length:6},(_,i)=>({boat_no:i+1,registration:String(4000+i),preview_at:iso,preview_source:'boatraceopenapi/v1',exhibition_time:6.8,course:i+1}))}]});
test('current day requires fresh event + all six entries + successful live log',()=>{assert.equal(databaseMeetingEvidence(evidence(),date,now).source,'db_recent_preview');for(const mutate of [x=>x.live_sync=null,x=>x.races[0].preview_at=null,x=>x.races[0].entry_preview_at=null,x=>x.races[0].boats=5,x=>x.races[0].preview_boats=5,x=>x.races[0].program=false,x=>x.date='2026-10-30']){const x=evidence();mutate(x);assert.equal(databaseMeetingEvidence(x,date,now).status,'unknown')}});
test('stale/future timestamps cannot refresh a meeting decision',()=>{for(const key of ['live_sync','preview_at','entry_preview_at'])for(const offset of [-601000,120000]){const x=evidence();if(key==='live_sync')x[key]=new Date(now+offset).toISOString();else x.races[0][key]=new Date(now+offset).toISOString();assert.equal(databaseMeetingEvidence(x,date,now).status,'unknown')}});
test('explicit cancellation always denies the affected race',()=>{const x=evidence();x.races[0].cancel='official_cancelled';assert.equal(databaseMeetingEvidence(x,date,now).status,'cancelled');x.races.push({...evidence().races[0],race_no:2});assert.deepEqual(databaseMeetingEvidence(x,date,now).eligibleRaces,[2])});
test('historical completed results confirm meeting; absence never proves non-meeting',()=>{const x=evidence();x.date='2026-10-30';x.races[0].finished=true;assert.equal(databaseMeetingEvidence(x,x.date,now).source,'db_historical_results');x.races=[];assert.equal(databaseMeetingEvidence(x,x.date,now).status,'unknown')});
test('fresh empty preview objects, unknown provenance and missing active exhibition never authorize',()=>{
 for(const change of [e=>e.preview_source=null,e=>e.preview_source='unverified',e=>e.preview_at=null,e=>e.exhibition_time=null,e=>e.course=null,e=>e.registration=null]){
 const x=evidence();change(x.races[0].entries[0]);assert.equal(databaseMeetingEvidence(x,date,now).status,'unknown');
 }
});
test('withdrawal/cancellation notes or duplicate registrations block a six-row roster',()=>{
 for(const note of ['欠場','中止','出走取消','順延','不成立','F','L','K','F 失格','フライング']){
 const x=evidence();x.races[0].entries[0].result_note=note;assert.equal(databaseMeetingEvidence(x,date,now).status,'unknown');
 }
 const x=evidence();x.races[0].entries[1].registration=x.races[0].entries[0].registration;assert.equal(databaseMeetingEvidence(x,date,now).status,'unknown');
});

