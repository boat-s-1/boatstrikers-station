import test from 'node:test';
import assert from 'node:assert/strict';
import { captureRace } from '../../app/lib/trinityShadowRunner.js';

const date = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+86400000));
const event = {race_date:date,course_code:1,race_no:12,closing_time:'23:59:00'};
const stamp = new Date(Date.now()-60000).toISOString();
const six = Array.from({length:6},(_,i)=>({
  boat_no:i+1,racer_registration_no:4000+i,racer_name:`racer${i+1}`,sex_code:1,
  national_win_rate:6.2,local_win_rate:5.8,motor_2_rate:35,boat_2_rate:30,
  average_st:0.15,created_at:stamp,updated_at:stamp
}));
const raceKey = `${date}:1:12:previous_day`;

function raceDb({unique=true,insertDelay=10}={}) {
  const stored=new Map();
  const attempts=[];
  let queue=Promise.resolve();
  return {
    stored,attempts,
    from(table) {
      const q={
        select(){return q},eq(){return q},lte(){return q},order(){return q},limit(){return q},
        then(resolve,reject) {
          return Promise.resolve({data:table==='bs_race_entries'?six:[],error:null}).then(resolve,reject);
        },
        async insert(rows) {
          attempts.push(rows);
          // Serializes the mock database transaction, NOT the callers' reads.
          const operation=queue.then(async()=>{
            await new Promise(resolve=>setTimeout(resolve,insertDelay));
            const keys=rows.map(r=>`${r.race_date}:${r.course_code}:${r.race_no}:${r.timing}:${r.engine_version}`);
            if(unique&&keys.some(k=>stored.has(k)))return {error:new Error('duplicate key value violates unique constraint')};
            for(let i=0;i<keys.length;i++)stored.set(keys[i],rows[i]);
            return {error:null};
          });
          queue=operation.then(()=>{});
          return operation;
        }
      };
      return q;
    }
  };
}

test('concurrent Cron attempts race, but unique atomic insert leaves one V2/V3 pair',async()=>{
  const db=raceDb(), a=new Map(),b=new Map();
  const results=await Promise.allSettled([
    captureRace(db,event,'previous_day',a),
    captureRace(db,event,'previous_day',b)
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value==='saved').length,1);
  assert.equal(results.filter(r=>r.status==='rejected'&&/unique constraint/.test(r.reason.message)).length,1);
  assert.equal(db.attempts.length,2,'both callers can attempt insert');
  assert.equal(db.stored.size,2);
  assert.deepEqual([...db.stored.values()].map(r=>r.engine_version).sort(),
    ['trinity-core-v2','trinity-v3-candidate-01']);
  assert.equal(a.has(raceKey)||b.has(raceKey),true);
});

test('without database uniqueness concurrent requests can duplicate snapshots',async()=>{
  const db=raceDb({unique:false});
  const results=await Promise.allSettled([
    captureRace(db,event,'previous_day',new Map()),
    captureRace(db,event,'previous_day',new Map())
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
  assert.equal(db.attempts.length,2);
  // Mock Map overwrites equal keys; actual unconstrained DB would contain four rows.
  assert.equal(db.attempts.flat().length,4);
});
