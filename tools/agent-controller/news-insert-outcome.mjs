// Pure offline insert outcome classifier. Never retries, republishes or modifies data.
export function classifyNewsInsertOutcome({errorCode=null,insertedCount=null,attemptedCount}){
  if(!Number.isSafeInteger(attemptedCount)||attemptedCount<0)throw Error('invalid attempted count');
  if(insertedCount!==null&&(!Number.isSafeInteger(insertedCount)||insertedCount<0||insertedCount>attemptedCount))throw Error('invalid inserted count');
  if(errorCode!==null&&(typeof errorCode!=='string'||!/^[A-Za-z0-9_]{1,20}$/.test(errorCode)))throw Error('invalid error code');
  if(errorCode!==null&&insertedCount!==null)throw Error('conflicting outcome evidence');
  let assessment='unconfirmed';
  if(errorCode==='23505')assessment='unique_conflict_review';
  else if(errorCode!==null)assessment='insert_error_review';
  else if(insertedCount===attemptedCount)assessment='insert_count_reported';
  else if(insertedCount!==null)assessment='partial_count_review';
  return {
    assessment,
    attempted_count:attemptedCount,
    inserted_count_reported:insertedCount,
    error_code:errorCode,
    no_side_effects_proven:false,
    automatic_retry_allowed:false,
    automatic_republish_allowed:false,
    safe_to_overwrite:false
  };
}
