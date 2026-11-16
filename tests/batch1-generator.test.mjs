import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { fakeDb } from './fixtures/batch1-db.mjs';
register('./fixtures/batch1-hooks.mjs',import.meta.url);
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-not-a-key';
const {generateDataLabSocialOutputs:generate}=await import('../lib/dataLabSocialGenerator.js');
const date='2026-11-14',T='bs_data_lab_social_outputs';
const digest={id:1,race_date:date,status:'complete',race_count:0,venue_count:0,manshu_count:0,manshu:[],incidents:[],featured_races:[],data_lab:{}};
function reset(extra={}) {return globalThis.__batch1db=fakeDb({bs_daily_result_digests:[digest],...extra});}
test('manual without digest never generates/publishes NEWS',async()=>{
  const db=reset({bs_daily_result_digests:[]});
  await assert.rejects(generate({date,generateDigestIfMissing:false}),/日次まとめ/);
  assert.ok(db.writes.every(w=>w.table===T));assert.equal(db.tables[T].length,0);
});
test('manual complete digest builds and CAS-saves once',async()=>{
  const db=reset();const r=await generate({date,generateDigestIfMissing:false});
  assert.equal(r.ok,true);assert.equal(r.status,'draft');assert.ok(r.x_post_text);
  assert.equal(db.writes.filter(w=>w.op==='update').length,1);assert.ok(db.writes.every(w=>w.table===T));
});
test('Cron and manual share one claim while running concurrently',async()=>{
  const db=reset();const rs=await Promise.all([generate({date}),generate({date,generateDigestIfMissing:false})]);
  assert.equal(rs.filter(r=>r.ok).length,1);assert.equal(db.tables[T].length,1);
});
test('Cron leaves existing draft intact',async()=>{
  const db=reset({[T]:[{id:10,race_date:date,status:'draft',updated_at:'2026-01-01T00:00:00Z',x_post_text:'keep'}]});
  assert.equal((await generate({date})).reason,'exists');assert.equal(db.writes.length,0);
});
test('generator cannot save after lease takeover',async()=>{
  const db=reset();db.before((t,q,ts)=>{if(t===T&&q.op==='update')ts[T][0].updated_at='2099-01-01T00:00:00.123456Z';});
  await assert.rejects(generate({date,generateDigestIfMissing:false}),error => error instanceof AggregateError && error.errors.length===2 && /lease lost/.test(error.errors[0].message) && /lease cleanup lost/.test(error.errors[1].message));
  assert.equal(db.tables[T][0].status,'generating');assert.equal(db.tables[T][0].x_post_text,undefined);
});
