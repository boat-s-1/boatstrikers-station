// Pure, offline state transition guard. No DB or network access.
export const OUTBOX_STATES = Object.freeze([
  'pending_review', 'approved', 'in_flight', 'delivered', 'failed', 'delivery_unknown',
]);
const transitions = Object.freeze({
  pending_review: Object.freeze({approve:'approved'}),
  approved: Object.freeze({start_delivery:'in_flight', revoke:'pending_review'}),
  in_flight: Object.freeze({receipt_confirmed:'delivered', provider_rejected:'failed', worker_lost:'delivery_unknown'}),
  failed: Object.freeze({retry_requested:'pending_review'}),
  delivery_unknown: Object.freeze({reconciled_not_sent:'pending_review', reconciled_delivered:'delivered'}),
  delivered: Object.freeze({}),
});
export function transitionOutboxState({state, event, operatorReviewed = false, authenticatedReceipt = false} = {}) {
  if (!OUTBOX_STATES.includes(state)) throw new Error('unknown state');
  if (typeof event !== 'string' || !event) throw new Error('event required');
  const next = transitions[state][event];
  if (!next) return {allowed:false, state, reason:'invalid_transition'};
  if (['approve','revoke','retry_requested','reconciled_not_sent','reconciled_delivered'].includes(event) && operatorReviewed !== true)
    return {allowed:false,state,reason:'operator_review_required'};
  if (['receipt_confirmed','reconciled_delivered'].includes(event) && authenticatedReceipt !== true)
    return {allowed:false,state,reason:'authenticated_receipt_required'};
  return {allowed:true,state:next,reason:'transition_proposal_only'};
}
