// Pure state-machine simulation of durable outbox replay. No network, no database.
// A crash after provider acceptance but before receipt persistence is inherently ambiguous.
const SAFE=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(s);
const STATES=new Set(['pending_review','approved','in_flight','delivered','failed','delivery_unknown']);
const EVENTS=new Set(['approve','begin_delivery','provider_accepted','provider_rejected','worker_crashed','retry_requested']);
export function simulateOutboxRecovery({outboxId,initialState='pending_review',events=[]}={}){
 if(!SAFE(outboxId)||!STATES.has(initialState)||!Array.isArray(events)||events.length>100||events.some(e=>!EVENTS.has(e)))throw Error('invalid recovery simulation');
 let state=initialState;let attempts=0;const history=[];
 for(const event of events){
  const before=state;
  if(event==='approve'&&state==='pending_review')state='approved';
  else if(event==='begin_delivery'&&state==='approved'){state='in_flight';attempts++}
  else if(event==='provider_accepted'&&state==='in_flight')state='delivered';
  else if(event==='provider_rejected'&&state==='in_flight')state='failed';
  else if(event==='worker_crashed'&&state==='in_flight')state='delivery_unknown';
  else if(event==='retry_requested'&&state==='failed')state='pending_review';
  else if(event==='retry_requested'&&state==='delivery_unknown')state='delivery_unknown';
  else throw Error('invalid state transition');
  history.push({event,from:before,to:state});
 }
 return {schema_version:1,outbox_id:outboxId,state,attempts,history,
  requires_manual_reconciliation:state==='delivery_unknown',
  automatic_retry_allowed:false,provider_idempotency_verified:false,
  delivery_receipt_persisted:false,network_call_executed:false,
  durable_state_persisted:false,simulation_only:true};
}
