// Isolated prototype only; not wired into production Hatsune cron logging.
// Supabase returns {error} on unsuccessful writes; awaiting alone is insufficient.
export async function assertLogUpdateSucceeded(updateOperation, expectedRunId) {
  if(typeof updateOperation!=='function') throw Error('update operation required');
  if(!Number.isSafeInteger(expectedRunId)||expectedRunId<=0) throw Error('expected run ID required');
  const result=await updateOperation();
  if(!result||typeof result!=='object'||Array.isArray(result)) throw Error('missing log update result');
  if(result.error) {
    const code=typeof result.error.code==='string' && /^[A-Za-z0-9_]{1,20}$/.test(result.error.code)?result.error.code:'unknown';
    throw Error('cron log update failed: '+code);
  }
  // Requires .select('id') on the Supabase update builder to confirm the affected row.
  if(!Array.isArray(result.data)||result.data.length!==1||!result.data[0]||!Number.isSafeInteger(result.data[0].id)||result.data[0].id!==expectedRunId) {
    throw Error('cron log update not confirmed');
  }
  return {confirmed:true,run_id:expectedRunId};
}
