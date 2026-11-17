// Verifies local hash-chain consistency only; does not authenticate event origin.
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
const validId=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(s);
export function buildCronMonitorEvidenceChain(records){
 if(!Array.isArray(records)||records.length>1000)throw Error('invalid records');
 let previous='0'.repeat(64);const chain=[];
 for(const r of records){
  if(!r||typeof r!=='object'||Object.keys(r).some(k=>!['event_id','at','kind','code'].includes(k))||!validId(r.event_id)||typeof r.at!=='string'||!/^\d{4}-\d\d-\d\dT/.test(r.at)||!/(Z|[+-]\d\d:\d\d)$/.test(r.at)||!Number.isFinite(Date.parse(r.at))||typeof r.kind!=='string'||!/^[a-z_]{2,32}$/.test(r.kind)||typeof r.code!=='string'||!/^[a-z_]{2,48}$/.test(r.code))throw Error('invalid record');
  const current=sha(JSON.stringify([previous,r.event_id,r.at,r.kind,r.code]));
  chain.push({event_id:r.event_id,previous_hash:previous,hash:current});previous=current;
 }
 return {schema_version:1,chain,head_hash:previous,local_integrity_only:true,origin_authenticated:false,immutable_storage_verified:false};
}
export function verifyCronMonitorEvidenceChain(records,expectedHead){
 if(typeof expectedHead!=='string'||!/^[0-9a-f]{64}$/.test(expectedHead))throw Error('invalid expected hash');
 const calculated=buildCronMonitorEvidenceChain(records);
 return {matches:calculated.head_hash===expectedHead,origin_authenticated:false,immutable_storage_verified:false};
}
