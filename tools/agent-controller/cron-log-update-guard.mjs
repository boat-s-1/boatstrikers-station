// Isolated prototype only; not wired into production Hatsune cron logging.
// Supabase returns {error} on unsuccessful writes; awaiting alone is insufficient.
export async function assertLogUpdateSucceeded(updateOperation) {
  if(typeof updateOperation!=='function') throw Error('update operation required');
  const result=await updateOperation();
  if(!result||typeof result!=='object'||Array.isArray(result)) throw Error('missing log update result');
  if(result.error) {
    const code=typeof result.error.code==='string'?result.error.code:'unknown';
    throw Error('cron log update failed: '+code);
  }
  // An update without returned rows cannot prove that the intended row was updated.
  if(!Array.isArray(result.data)||result.data.length!==1||!result.data[0]||!Number.isSafeInteger(result.data[0].id)) {
    throw Error('cron log update not confirmed');
  }
  return {confirmed:true,run_id:result.data[0].id};
}
