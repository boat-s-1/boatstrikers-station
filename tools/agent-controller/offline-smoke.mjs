// Pure offline diagnostic. No network calls, environment secrets, or production writes.
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
export function diagnose(input) {
  if(!input || typeof input !== 'object') throw Error('observation required');
  const mode=input.trinity_mode;
  if(!['migration','verification','production','provider_restricted'].includes(mode)) throw Error('unknown TRINITY mode');
  const state=mode==='migration'||mode==='provider_restricted'?'planned_pause':'requires_evidence';
  return {schema:'offline-smoke-v1',trinity:{mode,status:state},
    other_services:{discord:'not_checked',race_db:'not_checked',cron:'not_checked'},
    live_checks_performed:false,api_requests:0,production_writes:0};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=diagnose({trinity_mode:'migration'});
  const out=resolve('offline-report');mkdirSync(out,{recursive:true});
  writeFileSync(resolve(out,'diagnostic.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}
