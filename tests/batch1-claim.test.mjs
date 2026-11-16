import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeDb } from './fixtures/batch1-db.mjs';
import { claimDataLabGeneration as claim, saveDataLabClaim as save,
  releaseDataLabClaim as release, withDataLabClaim, validDataLabDate, DATA_LAB_TABLE as T } from '../lib/dataLabSocialClaim.js';
const date='2026-11-14', now=Date.parse('2026-11-15T01:00:00Z');
const draft={id:1,race_date:date,status:'draft',updated_at:'2026-11-14T01:00:00.123456+00:00',x_post_text:'original'};
const opts={now,allowDraft:true};
test('new date: 20 concurrent manual/Cron requests acquire exactly once',async()=>{
  const db=fakeDb(); const results=await Promise.all(Array.from({length:20},()=>claim(db.client,date,opts)));
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal(db.tables[T].length,1);
});
test('existing draft: concurrent conditional update has one owner',async()=>{
  const db=fakeDb({[T]:[draft]}); const rs=await Promise.all(Array.from({length:20},()=>claim(db.client,date,opts)));
  assert.equal(rs.filter(r=>r.ok).length,1);assert.equal(db.tables[T][0].x_post_text,'original');
});
test('Cron preserves existing draft',async()=>{
  const db=fakeDb({[T]:[draft]}); assert.equal((await claim(db.client,date,{now})).reason,'exists');assert.equal(db.writes.length,0);
});
for (const status of ['posted','approved','unknown']) test(`preserve ${status}`,async()=>{
  const db=fakeDb({[T]:[{...draft,status}]});assert.equal((await claim(db.client,date,opts)).reason,'locked');assert.equal(db.writes.length,0);
});
test('cooldown and stale lease boundaries reject and recover',async()=>{
  for(const [status,age,expected] of [['draft',60000,'recent'],['generating',300000,'busy'],['generating',300001,undefined]]) {
    const db=fakeDb({[T]:[{...draft,status,updated_at:new Date(now-age).toISOString()}]});
    const r=await claim(db.client,date,opts);assert.equal(r.reason,expected);assert.equal(r.ok,!expected);
  }
});
test('invalid timestamp fails closed',async()=>{
  const db=fakeDb({[T]:[{...draft,updated_at:'invalid'}]});assert.equal((await claim(db.client,date,opts)).reason,'invalid_timestamp');assert.equal(db.writes.length,0);
});
test('save and cleanup use exact DB microsecond timestamp',async()=>{
  const db=fakeDb();db.before((t,q)=>{if(q.op==='upsert')q.row.updated_at='2026-11-15T01:00:00.123456+00:00';});
  const c=await claim(db.client,date,opts);assert.match(c.updatedAt,/123456/);
  const saved=await save(db.client,c,{x_post_text:'new'});assert.equal(saved.status,'draft');
  await assert.rejects(release(db.client,c),/lease cleanup lost/);assert.equal(db.tables[T].length,1);
});
test('old owner cannot overwrite or delete replacement lease',async()=>{
  const db=fakeDb();const c=await claim(db.client,date,opts);
  db.tables[T][0].updated_at='2026-11-15T01:05:01.456789+00:00';
  await assert.rejects(save(db.client,c,{x_post_text:'stale'}),/lease lost/);
  await assert.rejects(release(db.client,c),/lease cleanup lost/);assert.equal(db.tables[T].length,1);assert.notEqual(db.tables[T][0].x_post_text,'stale');
});
test('failed new generation removes placeholder',async()=>{
  const db=fakeDb();await assert.rejects(withDataLabClaim(db.client,date,opts,async()=>{throw Error('fixture');}));assert.equal(db.tables[T].length,0);
});
test('failed regeneration retains draft content',async()=>{
  const db=fakeDb({[T]:[draft]});await assert.rejects(withDataLabClaim(db.client,date,opts,async()=>{throw Error('fixture');}));assert.equal(db.tables[T][0].status,'draft');assert.equal(db.tables[T][0].x_post_text,'original');
});
test('conditional claim loses if intervening writer posts draft',async()=>{
  const db=fakeDb({[T]:[draft]});db.before((t,q,ts)=>{if(q.op==='update')ts[T][0].status='posted';});
  assert.equal((await claim(db.client,date,opts)).reason,'busy');assert.equal(db.tables[T][0].status,'posted');
});
test('DB read error aborts without generating or writing',async()=>{
  const db=fakeDb();db.before(()=>{throw Error('fixture DB read failure');});
  await assert.rejects(withDataLabClaim(db.client,date,opts,async()=>{throw Error('must not build');}),/DB read failure/);assert.equal(db.writes.length,0);
});
test('cleanup failure is reported instead of silently claiming recovery',async()=>{
  const db=fakeDb();db.before((t,q)=>{if(q.op==='delete')throw Error('fixture cleanup failure');});
  await assert.rejects(withDataLabClaim(db.client,date,opts,async()=>{throw Error('fixture build');}),/cleanup also failed/);assert.equal(db.tables[T].length,1);
});
test('failed regeneration preserves even an empty pre-existing draft',async()=>{
  const db=fakeDb({[T]:[{...draft,x_post_text:''}]});
  await assert.rejects(withDataLabClaim(db.client,date,opts,async()=>{throw Error('fixture build');}));assert.equal(db.tables[T].length,1);assert.equal(db.tables[T][0].status,'draft');
});
for(const value of ['2026-02-30','2026-13-01','not-a-date','2026-1-01']) test(`reject date ${value}`,async()=>{
  assert.equal(validDataLabDate(value),false);await assert.rejects(claim(fakeDb().client,value,opts),/Invalid/);
});
