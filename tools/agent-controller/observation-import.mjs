// Strict, offline-only import boundary for operator-provided monitoring snapshots.
import {evaluateSnapshot} from './snapshot-evaluator.mjs';
const keys=['schema','trinity_mode','services'];
const services=['discord','cron','race_db'];
export function importObservation(raw) {
  if(typeof raw!=='string'||raw.length>16384) throw Error('observation must be a small JSON string');
  const value=JSON.parse(raw);
  if(!value||typeof value!=='object'||Array.isArray(value)) throw Error('invalid observation');
  for(const key of Object.keys(value)) if(!keys.includes(key)) throw Error('unexpected top-level field: '+key);
  if(!value.services||typeof value.services!=='object'||Array.isArray(value.services)) throw Error('services object required');
  for(const [name,item] of Object.entries(value.services)) {
    if(!services.includes(name)) throw Error('unexpected service: '+name);
    if(!item||typeof item!=='object'||Array.isArray(item)) throw Error('invalid service');
    for(const key of Object.keys(item)) if(!['result','observed_at'].includes(key)) throw Error('unexpected service field');
  }
  return evaluateSnapshot(value);
}
