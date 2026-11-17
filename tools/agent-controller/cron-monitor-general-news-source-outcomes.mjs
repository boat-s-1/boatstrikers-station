// Offline planning only. Does not fetch, retry, write or publish.
const KNOWN=new Set(['nikkan','macour','boatrace']);
export function planGeneralNewsSourceOutcomes({outcomes,requiredSources=['nikkan','macour','boatrace']}={}){
 const hold=(reason)=>Object.freeze({decision:'HOLD',reason,healthySources:[],failedSources:[],publicationAllowed:false,retryAllowed:false,sendAllowed:false});
 if(!Array.isArray(outcomes)||!Array.isArray(requiredSources)||requiredSources.length===0)return hold('invalid_input');
 if(requiredSources.some(x=>!KNOWN.has(x))||new Set(requiredSources).size!==requiredSources.length)return hold('invalid_source_contract');
 if(outcomes.length!==requiredSources.length)return hold('missing_or_extra_source');
 const seen=new Set(),healthy=[],failed=[];
 for(const entry of outcomes){
  if(!entry||!requiredSources.includes(entry.source)||seen.has(entry.source)||!['fulfilled','rejected'].includes(entry.status))return hold('invalid_or_duplicate_outcome');
  seen.add(entry.source);
  if(entry.status==='fulfilled'){
   if(!Number.isSafeInteger(entry.found)||entry.found<0)return hold('invalid_success_count');
   healthy.push({source:entry.source,found:entry.found});
  }else{
   if(!['timeout','http_error','network_error','unknown'].includes(entry.errorCategory))return hold('invalid_error_category');
   failed.push({source:entry.source,errorCategory:entry.errorCategory});
  }
 }
 if(seen.size!==requiredSources.length)return hold('missing_source');
 return Object.freeze({decision:failed.length?'DEGRADED':'HEALTHY',reason:failed.length?'source_partial_failure':'all_sources_fulfilled',healthySources:healthy,failedSources:failed,publicationAllowed:false,retryAllowed:false,sendAllowed:false});
}
