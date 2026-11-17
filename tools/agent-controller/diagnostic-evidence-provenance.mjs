// Offline evidence metadata validator. Caller-supplied timestamps never imply independent verification.
const SOURCES=new Set(['synthetic_fixture','readonly_supabase_aggregate','readonly_vercel_runtime','manual_observation']);
export function validateDiagnosticEvidence({source,observedAt,referenceAt,maxAgeMs=15*60*1000,environment='unknown'}){
  if(!SOURCES.has(source))throw Error('invalid evidence source');
  if(!['synthetic','production','staging','unknown'].includes(environment))throw Error('invalid environment');
  if(typeof observedAt!=='string'||typeof referenceAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(observedAt)||!/^\d{4}-\d\d-\d\dT/.test(referenceAt)||!/(Z|[+-]\d\d:\d\d)$/.test(observedAt)||!/(Z|[+-]\d\d:\d\d)$/.test(referenceAt))throw Error('invalid timestamp format');
  const observed=Date.parse(observedAt),reference=Date.parse(referenceAt);
  if(!Number.isFinite(observed)||!Number.isFinite(reference))throw Error('invalid timestamp');
  if(!Number.isSafeInteger(maxAgeMs)||maxAgeMs<0)throw Error('invalid max age');
  if(observed>reference)throw Error('future evidence timestamp');
  const age=reference-observed;
  const synthetic=source==='synthetic_fixture'||environment==='synthetic';
  const inconsistent=source==='synthetic_fixture'&&environment==='production';
  if(inconsistent)throw Error('synthetic evidence cannot be production');
  const freshness=age>maxAgeMs?'stale':'within_age_window';
  return {
    source,environment,observed_at:observedAt,reference_at:referenceAt,age_ms:age,
    freshness,synthetic,independently_verified:false,
    current_production_status_claim_allowed:false,
    evidence_use:synthetic?'test_only':freshness==='stale'?'historical_review':'manual_review_required'
  };
}
