import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {orchestrateGamagori,dueTasks,jstDate,parseGamagoriCalendar} from './gamagori-chart-orchestrator.mjs';
const date='2026-10-27',time=Date.parse(date+'T21:00:00+09:00');
function harness({state,calendar,collect,stopAt}={}) {
 let clock=time,calls=[],saved=new Set(),sequence=[];
 const tasks=Array.from({length:5},(_,i)=>({race_no:i+1,status:'pending',attempts:0,upstream_attempts:0}));
 const snapshot=state??{day:{calendar_status:'held',checked_at:new Date(time).toISOString()},events:tasks.map(t=>({race_no:t.race_no,deadline_time:'20:00:00'})),tasks};
 const repo={async prepare(){for(const t of snapshot.tasks)if(saved.has(t.race_no))t.status='complete';else if(t.status==='running')t.status='pending';return snapshot},async day(d,s){sequence.push(s)},
  async claim(d,r){sequence.push('claim:'+r);const t=snapshot.tasks.find(t=>t.race_no===r);if(t.status!=='pending')return false;t.status='running';t.attempts++;return true},
  async finishTask(d,t,r){if(stopAt===t.race_no)throw Error('checkpoint crash');t.status=['saved','skipped_existing'].includes(r.status)?'complete':'pending';t.last_attempt_at=new Date(clock).toISOString()},
  async finishRun(...args){sequence.push(args[1])},async halt(){sequence.push('halt')}};
 return {snapshot,saved,calls,sequence,run:()=>orchestrateGamagori({repo,date,owner:'test',now:()=>clock,sleep:async ms=>{clock+=ms},calendar:calendar??(async()=> 'held'),collect:collect??(async options=>{calls.push(options);saved.add(options.first);return {results:[{race:options.first,status:'saved',upstream_attempts:1}]}})})};
}
test('JST day boundary and official held/non-meeting fixtures; malformed calendars fail closed',()=>{
 assert.equal(jstDate(Date.parse('2026-10-30T15:00:00Z')),'2026-10-31');
 for(const [file,date,status] of [['calendar-20261031','2026-10-31','held'],['calendar-20261026','2026-10-26','no_meeting'],['calendar-20250809','2025-08-09','held']])assert.equal(parseGamagoriCalendar(readFileSync(new URL('../tests/fixtures/gamagori/'+file+'.html',import.meta.url),'utf8'),date),status);
 assert.throws(()=>parseGamagoriCalendar('maintenance',date));
 assert.throws(()=>parseGamagoriCalendar('<p>開催期間/日次</p>',date));
});
test('one invocation selects max 3, shared deadline and durable claims before fetch',async()=>{
 const h=harness();await h.run();assert.equal(h.calls.length,3);assert(h.calls.every(x=>x.deadlineAt===time+38000));assert.deepEqual(h.sequence.slice(0,3),['claim:1','claim:2','claim:3']);
 await h.run();assert.deepEqual(h.calls.map(x=>x.first),[1,2,3,4,5]);
});
test('official non-meeting and unknown calendar never fetch charts even with DB events',async()=>{
 for(const calendar of [async()=> 'no_meeting',async()=>{throw Error('unavailable')}]) {
  const h=harness({calendar});h.snapshot.day.checked_at=null;const r=await h.run();assert.equal(h.calls.length,0);assert(['non_meeting','calendar_unknown'].includes(r.outcome));
 }
});
test('unpublished/future/unknown-deadline/cancellation and retry backoff are excluded from due set',()=>{
 const h=harness();const s=h.snapshot;s.events[0].deadline_time='21:20:00';s.events[1].deadline_time=null;s.events[2].race_cancel_code='1';s.tasks[3].next_attempt_at=new Date(time+120000).toISOString();s.tasks[4].attempts=6;
 assert.equal(dueTasks(s,date,time).length,0);
});
test('invalid chart stays retryable and never prevents later ready races from progressing',async()=>{
 const h=harness({collect:async({first})=>({results:[{race:first,status:'failed',reason:'invalid_chart',upstream_attempts:1}]})});
 const r=await h.run();assert.equal(r.results.length,3);assert(h.snapshot.tasks.slice(0,3).every(t=>t.status==='pending'));
 assert.deepEqual(dueTasks(h.snapshot,date,time).map(x=>x.task.race_no),[4,5,1]);
});
test('save followed by checkpoint crash resumes from saved chart without overwriting',async()=>{
 const h=harness({stopAt:1});await assert.rejects(h.run(),/orchestration_failed/);assert(h.saved.has(1));
 // A fresh invocation reconciles the saved six-boat chart, so race 1 is never fetched again.
 await h.run();assert.equal(h.calls.filter(x=>x.first===1).length,1);assert.equal(h.snapshot.tasks[0].status,'complete');
});
test('403/429 halt the batch and future invocations observe cooldown',async()=>{
 for(const reason of ['upstream_http_403','upstream_http_429']){
  const h=harness({collect:async({first})=>({results:[{race:first,status:'failed',reason,upstream_attempts:1}]})});const r=await h.run();assert.equal(r.results.length,1);assert(h.sequence.includes('halt'));
  h.snapshot.day.blocked_until=new Date(time+1800000).toISOString();assert.equal((await h.run()).outcome,'cooldown');
 }
});
test('calendar held but event sync missing is distinct from non-meeting',async()=>{
 const h=harness();h.snapshot.events=[];assert.equal((await h.run()).outcome,'event_data_missing');assert.equal(h.calls.length,0);
});

test('past-day backfill can proceed when historical deadline time is missing',()=>{
 const h=harness();for(const e of h.snapshot.events)e.deadline_time=null;
 assert.equal(dueTasks(h.snapshot,date,time+24*3600000).length,3);
});
