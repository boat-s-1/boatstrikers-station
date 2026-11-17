// Offline simulation of a transactional unique-key reservation store.
const safe=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(s);
export function simulateAtomicIncidentReservations({incidentKeys,existingKeys=[]}){
 if(!Array.isArray(incidentKeys)||!Array.isArray(existingKeys)||incidentKeys.length>1000||existingKeys.length>1000||[...incidentKeys,...existingKeys].some(x=>!safe(x)))throw Error('invalid keys');
 const held=new Set(existingKeys),accepted=[],rejected=[];
 for(const key of incidentKeys){if(held.has(key))rejected.push(key);else{held.add(key);accepted.push(key)}}
 return {schema_version:1,accepted,rejected,unique_incidents:held.size,
  simulation_only:true,database_transaction_executed:false,durable_storage_created:false,
  notifications_sent:false,automatic_retry_allowed:false};
}
