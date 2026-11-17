// Fail-closed offline operator kill-switch policy. No actual deployment changes.
export function assessCronMonitorKillSwitch({operatorStop=true,credentialsHealthy=false,budgetHealthy=false,ledgerHealthy=false,deliveryHealthy=false,productionApproval=false}={}){
 const flags={operatorStop,credentialsHealthy,budgetHealthy,ledgerHealthy,deliveryHealthy,productionApproval};
 if(Object.values(flags).some(v=>typeof v!=='boolean'))throw Error('invalid switch flag');
 const reasons=[];
 if(operatorStop)reasons.push('operator_stop');
 if(!credentialsHealthy)reasons.push('credential_gate');
 if(!budgetHealthy)reasons.push('budget_gate');
 if(!ledgerHealthy)reasons.push('ledger_gate');
 if(!deliveryHealthy)reasons.push('delivery_gate');
 if(!productionApproval)reasons.push('approval_gate');
 return {schema_version:1,decision:reasons.length?'hold':'eligible_for_separate_operator_review',reasons,
  actual_monitor_enabled:false,actual_monitor_disabled:false,automatic_replay_allowed:false,production_mutation_performed:false};
}
