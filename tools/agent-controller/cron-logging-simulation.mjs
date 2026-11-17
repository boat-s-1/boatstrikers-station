import {assertLogUpdateSucceeded} from './cron-log-update-guard.mjs';
import {decideCronLogFailure} from './cron-log-failure-policy.mjs';
// Offline integration simulation only. Does not run any production route.
export async function simulateCronLogging({pipelineResult,expectedRunId,updateOperation}) {
  let logUpdateConfirmed=false;
  try {
    await assertLogUpdateSucceeded(updateOperation,expectedRunId);
    logUpdateConfirmed=true;
  } catch {
    // Do not leak upstream error content or retry business operations.
  }
  return decideCronLogFailure({pipelineResult,logUpdateConfirmed});
}
