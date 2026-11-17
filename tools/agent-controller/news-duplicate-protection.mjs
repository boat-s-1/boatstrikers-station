// Offline-only assessment of uniqueness coverage. Does not query or mutate a DB.
export function assessNewsDuplicateProtection({sourceKeyPresent,sourceKeyUniqueConstraint,concurrentWritersPossible,titleUniqueConstraint=false}){
  for(const [name,value] of Object.entries({sourceKeyPresent,sourceKeyUniqueConstraint,concurrentWritersPossible,titleUniqueConstraint})){
    if(typeof value!=='boolean')throw Error('invalid '+name);
  }
  const keyProtected=sourceKeyPresent&&sourceKeyUniqueConstraint;
  return {
    same_source_key_protected:keyProtected,
    title_only_duplicate_protected:titleUniqueConstraint,
    concurrent_insert_conflict_possible:concurrentWritersPossible&&keyProtected,
    missing_key_risk:!sourceKeyPresent,
    automatic_replay_allowed:false,
    automatic_republish_allowed:false,
    outcome:'manual_review_required'
  };
}
