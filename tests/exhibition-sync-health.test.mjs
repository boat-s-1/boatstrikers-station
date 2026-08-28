import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePcSync, summarizeVenueAttempts } from '../lib/exhibitionSyncHealth.js';
const date = '2026-08-28', now = new Date('2026-08-28T12:00:00Z');
const step = { step: 'pc_kyotei_exhibition', target_date: date, status: 'success', source_rows: 6, valid_rows: 6, sync_checked_at: '2026-08-28T20:59:00+09:00' };
const runtime = { state: 'idle', heartbeat_at: '2026-08-28T11:59:00Z', last_status: 'success', last_summary: { steps: [step] } };
function summary(change = {}, root = {}) { return summarizePcSync({ ...runtime, ...root, last_summary: { steps: [{ ...step, ...change }] } }, date, now); }
test('recent worker and valid exhibition are independent', () => { const s=summary(); assert.equal(s.worker,'responding'); assert.equal(s.exhibition,'received'); assert.equal(s.validRows,6); });
test('overall success cannot hide zero same-day rows', () => { const s=summary({ status:'waiting_exhibition',source_rows:0,valid_rows:0 }); assert.equal(s.worker,'responding'); assert.equal(s.exhibition,'zero'); });
test('stale heartbeat does not erase last known exhibition', () => { const s=summary({}, {heartbeat_at:'2026-08-28T11:30:00Z'}); assert.equal(s.worker,'stale'); assert.equal(s.exhibition,'received'); });
test('29 minutes is not stopped', () => assert.equal(summary({}, {heartbeat_at:'2026-08-28T11:31:00Z'}).worker,'responding'));
test('missing and future heartbeat are unknown', () => { for(const heartbeat_at of [null,'bad','2026-08-28T12:10:00Z']) assert.equal(summary({}, {heartbeat_at}).worker,'unknown'); });
test('running state is not proof exhibition updated', () => { const s=summary({status:'pending',source_rows:null,valid_rows:null},{state:'running'}); assert.equal(s.worker,'running'); assert.equal(s.exhibition,'waiting'); });
test('yesterday and tomorrow summaries never count for selected date', () => { for(const target_date of ['2026-08-27','2026-08-29',null,'2026-02-30']) {const s=summary({target_date}); assert.equal(s.exhibition,'date_unchecked'); assert.equal(s.sourceRows,null); assert.equal(s.validRows,null);} });
test('missing numeric fields are unknown, not zero', () => { for(const n of [null,undefined,'',false,-1,'bad']) {const s=summary({source_rows:n,valid_rows:n}); assert.equal(s.sourceRows,null); assert.equal(s.exhibition,'unknown');} });
test('failure and invalid values are separate', () => { assert.equal(summary({status:'failed',source_rows:0}).exhibition,'error'); assert.equal(summary({returncode:1}).exhibition,'error'); assert.equal(summary({valid_rows:0}).exhibition,'invalid'); });
test('no step means waiting, not healthy/zero', () => assert.equal(summarizePcSync({...runtime,last_summary:{steps:[]}},date,now).exhibition,'waiting'));
test('raw logs and paths never leave summarizer', () => {const s=summary({csv:'C:\\Secret',message:'SECRET',pc_kyotei_diagnostics:{brd_c3:{latest_yyyymmdd:'20260828',target_date_rows:6,secret:'SECRET'},brd_c4:{latest_yyyymmdd:'20260827',target_date_rows:0}}},{last_error:'SECRET'}); assert.equal(JSON.stringify(s).includes('SECRET'),false); assert.deepEqual(s.inputs,[{key:'brd_c3',latestDate:date,rows:6},{key:'brd_c4',latestDate:'2026-08-27',rows:0}]); });
test('later success clears old failure for the same race only', () => {
 const rows=[{race_date:date,course_code:5,race_no:1,checked_at:'2026-08-28T11:00:00Z',reason_code:'network'}, {race_date:date,course_code:5,race_no:1,checked_at:'2026-08-28T11:01:00Z',reason_code:'ready'}, {race_date:date,course_code:5,race_no:2,checked_at:'2026-08-28T11:02:00Z',reason_code:'timeout'}, {race_date:'2026-08-29',course_code:5,race_no:3,checked_at:'2026-08-29T11:03:00Z',reason_code:'ready'}];
 const s=summarizeVenueAttempts(rows,date,5); assert.equal(s.races.length,2); assert.equal(s.races[0].reason_code,'ready'); assert.equal(s.latest.race_no,2); assert.equal(summarizeVenueAttempts(rows,date,6).latest,null);
});
