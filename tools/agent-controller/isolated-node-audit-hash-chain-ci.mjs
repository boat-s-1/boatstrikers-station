import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
if(process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='agent_controller_ci'||process.env.PGUSER!=='agent_ci') throw new Error('Refusing non-CI PostgreSQL target');
const sql=q=>execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-qAt','-c',q],{encoding:'utf8',timeout:10000}).trim();
const rows=sql("SELECT audit_id,receipt_id,incident_key,conflict_reason FROM agent_monitor.receipt_conflict_audit_ci ORDER BY audit_id").split('\n').map(line=>line.split('|'));
assert.equal(rows.length,4);
const digest=s=>createHash('sha256').update(s).digest('hex');
let previous='0'.repeat(64);
const chain=rows.map(fields=>{
 const hash=digest(JSON.stringify({previous,fields}));
 const entry={previous,fields,hash};
 previous=hash;
 return entry;
});
function verify(entries){
 let prev='0'.repeat(64);
 for(const entry of entries){
  if(entry.previous!==prev||digest(JSON.stringify({previous:prev,fields:entry.fields}))!==entry.hash)return false;
  prev=entry.hash;
 }
 return true;
}
assert.equal(verify(chain),true);
const changed=structuredClone(chain);
changed[1].fields[3]='receipt_or_incident_mismatch'===changed[1].fields[3]?'payload_digest_mismatch':'receipt_or_incident_mismatch';
assert.equal(verify(changed),false);
const removed=chain.filter((_,i)=>i!==1);
assert.equal(verify(removed),false);
const reordered=[chain[1],chain[0],...chain.slice(2)];
assert.equal(verify(reordered),false);
const originalTail=chain.at(-1).hash;
assert.match(originalTail,/^[a-f0-9]{64}$/);
console.log('PASS: synthetic DB audit hash chain detects edits, omissions and reorder; tail='+originalTail);
