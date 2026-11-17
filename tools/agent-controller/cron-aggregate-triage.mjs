import {normalizeReadonlyCronAggregate} from './readonly-cron-aggregate-adapter.mjs';
import {validateDiagnosticEvidence} from './diagnostic-evidence-provenance.mjs';
// Aggregate triage is offline and descriptive, never an authorization to rerun jobs.
export function buildCronAggregateTriage({aggregateInput,evidenceInput}){
  const aggregate=normalizeReadonlyCronAggregate(aggregateInput);
  const evidence=validateDiagnosticEvidence(evidenceInput);
  if(evidence.observed_at!==aggregate.observed_at)throw Error('observation timestamp mismatch');
  if(evidence.source!=='readonly_supabase_aggregate')throw Error('invalid aggregate evidence source');
  const counts=aggregate.counts;
  const issues=[];
  if(counts.running_without_finish>0)issues.push('unfinished_run_logs');
  if(counts.partial_runs>0)issues.push('partial_runs');
  if(counts.windows_with_articles<counts.runs_total)issues.push('windows_without_observed_articles');
  const priority=counts.running_without_finish>0&&counts.partial_runs>0?'high_review':
    counts.running_without_finish>0||counts.partial_runs>0?'review':'observation_only';
  const usable=evidence.environment==='production'&&evidence.freshness==='within_age_window'&&!evidence.synthetic;
  return {
    schema_version:1,aggregate,evidence,
    display:evidence.synthetic?'テストデータ':evidence.freshness==='stale'?'過去の観測':'集計上の要確認',
    review_priority:usable?priority:'historical_or_test_only',
    issues,
    temporal_article_matches_are_not_run_attribution:true,
    live_health_verified:false,
    automatic_retry_allowed:false,
    automatic_republish_allowed:false
  };
}
