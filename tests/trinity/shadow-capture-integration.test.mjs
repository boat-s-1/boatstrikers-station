import test from 'node:test';
import assert from 'node:assert/strict';
import { captureRace } from '../../app/lib/trinityShadowRunner.js';

const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 86400000));
const event = { race_date: date, course_code: 1, race_no: 12, closing_time: '23:59:00' };
const stamp = new Date(Date.now() - 60000).toISOString();
const six = Array.from({length:6},(_,i)=>({
  boat_no:i+1, racer_registration_no:4000+i, racer_name:`racer${i+1}`, sex_code:1,
  national_win_rate:6.2, local_win_rate:5.8, motor_2_rate:35, boat_2_rate:30,
  average_st:0.15, exhibition_time:6.7, exhibition_st:0.12,
  created_at:stamp,updated_at:stamp
}));
const raceKey = `${date}:1:12:previous_day`;
const versions = ['trinity-core-v2','trinity-v3-candidate-01'];

function fakeDb(source=six) {
  const writes=[];
  const calls=[];
  const db={writes,calls,from(table){
    calls.push(table);
    const q={
      select(){return q},eq(){return q},lte(){return q},order(){return q},limit(){return q},
      then(resolve,reject){return Promise.resolve({data:table==='bs_race_entries'?source:[],error:null}).then(resolve,reject)},
      async insert(rows){writes.push({table,rows});return {error:null}}
    };
    return q;
  }};
  return db;
}

test('six contemporaneous boats generate and insert V2/V3 as one matching pair', async()=>{
  const db=fakeDb(), existing=new Map(), diagnostics={};
  const status=await captureRace(db,event,'previous_day',existing,diagnostics);
  assert.equal(status,'saved');
  assert.equal(diagnostics.entry_count,6);
  assert.equal(db.writes.length,1);
  assert.equal(db.writes[0].table,'trinity_prediction_snapshots');
  const pair=db.writes[0].rows;
  assert.equal(pair.length,2);
  assert.deepEqual(pair.map(x=>x.engine_version),versions);
  assert.equal(pair[0].source_captured_at,pair[1].source_captured_at);
  assert.deepEqual(pair[0].boat_features,pair[1].boat_features);
  assert.equal(pair[0].top_combination,pair[1].top_combination);
  assert.notEqual(pair[0].prediction_id,pair[1].prediction_id);
  assert.equal(existing.get(raceKey).size,2);
  assert.equal(await captureRace(db,event,'previous_day',existing),'exists');
  assert.equal(db.writes.length,1,'repeat must not write again');
});

test('one saved version blocks reconstruction of missing half',async()=>{
  const db=fakeDb(),existing=new Map([[raceKey,new Set([versions[0]])]]);
  assert.equal(await captureRace(db,event,'previous_day',existing),'partial_pair');
  assert.equal(db.writes.length,0);
  assert.equal(db.calls.length,0);
});

test('incomplete six-boat input refuses persistence',async()=>{
  const db=fakeDb(six.slice(0,5));
  await assert.rejects(captureRace(db,event,'previous_day',new Map()),/Six complete, contemporaneous entries/);
  assert.equal(db.writes.length,0);
});

test('insert error does not mark versions as saved',async()=>{
  const db=fakeDb(),existing=new Map();
  db.from=(table)=>{
    const q={select(){return q},eq(){return q},lte(){return q},order(){return q},limit(){return q},
      then(resolve,reject){return Promise.resolve({data:table==='bs_race_entries'?six:[],error:null}).then(resolve,reject)},
      async insert(){return {error:new Error('mock insert rejected')}}};
    return q;
  };
  await assert.rejects(captureRace(db,event,'previous_day',existing),/mock insert rejected/);
  assert.equal(existing.has(raceKey),false);
});
