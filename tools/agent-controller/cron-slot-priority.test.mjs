import test from 'node:test';
import assert from 'node:assert/strict';
import {prioritizeCronSlots as rank} from './cron-slot-priority.mjs';
const rows=[
{jst_slot:'10:00',total_runs:21,running_runs:11,partial_runs:10,missing_completion:11,no_article_windows:0,article_matches:91},
{jst_slot:'14:00',total_runs:21,running_runs:7,partial_runs:14,missing_completion:7,no_article_windows:5,article_matches:19},
{jst_slot:'22:00',total_runs:21,running_runs:16,partial_runs:5,missing_completion:16,no_article_windows:0,article_matches:318}];
test('22:00 ranks first for missing completion',()=>assert.equal(rank(rows)[0].slot_jst,'22:00'));
test('14:00 ranks second',()=>assert.equal(rank(rows)[1].slot_jst,'14:00'));
test('10:00 ranks third by weighted score',()=>assert.equal(rank(rows)[2].slot_jst,'10:00'));
test('14:00 reason is partial failure',()=>assert.equal(rank(rows).find(x=>x.slot_jst==='14:00').priority_reason,'partial_failure_review'));
test('22:00 reason is completion logging',()=>assert.equal(rank(rows)[0].priority_reason,'completion_logging_review'));
test('never triggers retries',()=>assert.equal(rank(rows)[0].automatic_retry,false));
test('never claims health',()=>assert.equal(rank(rows)[0].pipeline_health,'unknown'));
test('preserves article matches without attributing',()=>assert.equal(rank(rows)[0].temporal_article_matches,318));
test('reject duplicate slots',()=>assert.throws(()=>rank([rows[0],rows[0]]),/invalid slot/));
test('reject negative counts',()=>assert.throws(()=>rank([{...rows[0],running_runs:-1}]),/invalid running_runs/));
test('reject inconsistent statuses',()=>assert.throws(()=>rank([{...rows[0],running_runs:22}]),/inconsistent slot counts/));
test('reject invalid time',()=>assert.throws(()=>rank([{...rows[0],jst_slot:'25:00'}]),/invalid slot/));
