import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCronDiagnosticReport as report} from './cron-diagnostic-report.mjs';
// Synthetic cases inspired by aggregate evidence, not production row replays.
const stages=[{name:'collection',outcome:'completed',durationMs:15000},{name:'media',outcome:'completed',durationMs:8000},{name:'general',outcome:'completed',durationMs:25000}];
const input={runKey:'synthetic-running-22',stageObservations:stages,stageOutcome:'unknown',logOutcome:'unknown',articleEvidence:'records_present',requestElapsedMs:null};
test('running-like with article records never replay',()=>{const x=report(input);assert.equal(x.display,'要確認');assert.equal(x.automatic_retry_allowed,false);assert.equal(x.automatic_republish_allowed,false)});
test('running-like does not prove absence of side effects',()=>assert.equal(report(input).completion.no_side_effects_proven,false));
test('running-like cannot invent elapsed request time',()=>assert.equal(report(input).timing.request_elapsed_ms,null));
test('running-like reports missing timing',()=>assert.equal(report(input).priority_issues.includes('timing_evidence_incomplete'),true));
test('partial-like with general source error is issue',()=>assert.equal(report({...input,runKey:'synthetic-partial-14',stageOutcome:'failed',logOutcome:'confirmed',requestElapsedMs:58000}).display,'一部問題あり'));
test('partial-like still cannot assert delivery',()=>assert.equal(report({...input,stageOutcome:'failed',logOutcome:'confirmed',requestElapsedMs:58000}).actual_delivery_verified,false));
test('60-second timeout-like is issue',()=>assert.equal(report({...input,runKey:'synthetic-timeout-22',logOutcome:'timeout',deadlineExceeded:true,requestElapsedMs:60000}).display,'一部問題あり'));
test('timeout-like with articles cannot republish',()=>assert.equal(report({...input,logOutcome:'timeout',deadlineExceeded:true,requestElapsedMs:60000}).automatic_republish_allowed,false));
test('no-article-window still not safe to replay',()=>assert.equal(report({...input,articleEvidence:'none_observed'}).automatic_retry_allowed,false));
test('completed-like with no article evidence still cannot claim delivery',()=>assert.equal(report({...input,runKey:'synthetic-complete',stageOutcome:'completed',logOutcome:'confirmed',articleEvidence:'none_observed',requestElapsedMs:50000}).actual_delivery_verified,false));
test('high overhead is surfaced',()=>assert.equal(report({...input,requestElapsedMs:58000}).timing.unaccounted_elapsed_ms,10000));
test('near deadline warning is surfaced',()=>assert.equal(report({...input,requestElapsedMs:58000}).priority_issues.includes('limited_headroom'),true));
