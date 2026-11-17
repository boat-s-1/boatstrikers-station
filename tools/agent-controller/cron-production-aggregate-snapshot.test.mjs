import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCronAggregateTriage} from './cron-aggregate-triage.mjs';
// Sanitized historical snapshot; static test data, NOT a live read or attested source.
const aggregateInput={observed_at:'2026-11-17T08:41:40Z',window_start:'2026-10-27T08:41:40Z',window_end:'2026-11-17T08:38:40Z',runs_total:63,running_without_finish:34,partial_runs:29,windows_with_articles:58,temporal_article_matches:428};
const evidenceInput={source:'readonly_supabase_aggregate',environment:'production',observedAt:'2026-11-17T08:41:40Z',referenceAt:'2026-11-17T08:46:40Z'};
const run=(e=evidenceInput)=>buildCronAggregateTriage({aggregateInput,evidenceInput:e});
test('snapshot counts normalize',()=>assert.equal(run().aggregate.counts.temporal_article_matches,428));
test('snapshot reports high review',()=>assert.equal(run().review_priority,'high_review'));
test('snapshot flags unfinished logs',()=>assert.ok(run().issues.includes('unfinished_run_logs')));
test('snapshot flags partial runs',()=>assert.ok(run().issues.includes('partial_runs')));
test('snapshot flags zero-article windows',()=>assert.ok(run().issues.includes('windows_without_observed_articles')));
test('snapshot never verifies live health',()=>assert.equal(run().live_health_verified,false));
test('snapshot never proves article causality',()=>assert.equal(run().aggregate.article_causality_verified,false));
test('snapshot never proves delivery',()=>assert.equal(run().aggregate.delivery_verified,false));
test('snapshot never authorizes retry',()=>assert.equal(run().automatic_retry_allowed,false));
test('snapshot is historical when reference time advances',()=>assert.equal(run({...evidenceInput,referenceAt:'2026-11-17T09:00:00Z'}).display,'過去の観測'));
test('snapshot is historical-only for later reference',()=>assert.equal(run({...evidenceInput,referenceAt:'2026-11-17T09:00:00Z'}).review_priority,'historical_or_test_only'));
test('snapshot cannot be falsely marked independently verified',()=>assert.equal(run().evidence.independently_verified,false));
