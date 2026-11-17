import {transitionOutboxState} from './cron-monitor-outbox-transition-guard.mjs';

// Offline deterministic orchestrator: emits proposals, never writes or sends.
// Authorization and receipt flags are test fixtures, not verified identities.
export function planOutboxWorkerCycle({initialState='pending_review',steps=[]}={}) {
  if (!Array.isArray(steps) || steps.length>50) throw new Error('steps must be an array of at most 50');
  let state=initialState;
  const audit=[];
  for(let i=0;i<steps.length;i++){
    const step=steps[i];
    if(!step || typeof step!=='object' || Array.isArray(step)) throw new Error('invalid step');
    const result=transitionOutboxState({state,event:step.event,operatorReviewed:step.operatorReviewed,authenticatedReceipt:step.authenticatedReceipt});
    audit.push(Object.freeze({index:i,event:step.event,from:state,to:result.state,allowed:result.allowed,reason:result.reason}));
    if(!result.allowed) return Object.freeze({decision:'hold',state,audit:Object.freeze(audit),sendAllowed:false,persistenceAllowed:false});
    state=result.state;
  }
  return Object.freeze({decision:'proposal_only',state,audit:Object.freeze(audit),sendAllowed:false,persistenceAllowed:false});
}
