// Offline-only aggregate diagnostic. Inputs must be counts from a read-only query.
export function buildNewsCronDiagnostic(rows){
  if(!Array.isArray(rows)||rows.length===0)throw Error('aggregate rows required');
  const out={running:null,partial:null,other:[],total_runs:0,missing_completion_runs:0,temporal_article_matches:0,automatic_replay_allowed:false,production_health:'未確認'};
  const seen=new Set();
  for(const row of rows){
    if(!row||typeof row!=='object'||Array.isArray(row)||!['running','partial','success','error'].includes(row.status)||seen.has(row.status))throw Error('invalid aggregate status');
    seen.add(row.status);
    for(const key of ['runs','no_completion_timestamp','windows_with_articles','articles_in_windows','published_flag_in_windows','reported_inserted_total','runs_with_reported_errors']){
      if(!Number.isSafeInteger(row[key])||row[key]<0)throw Error('invalid aggregate '+key);
    }
    if(row.no_completion_timestamp>row.runs||row.windows_with_articles>row.runs||row.published_flag_in_windows>row.articles_in_windows||row.runs_with_reported_errors>row.runs)throw Error('inconsistent aggregate');
    const item={status:row.status,runs:row.runs,missing_completion:row.no_completion_timestamp,windows_with_articles:row.windows_with_articles,temporal_article_matches:row.articles_in_windows,reported_inserted:row.reported_inserted_total,display:row.status==='partial'?'一部問題あり':row.status==='running'?'要確認':'記録のみ確認'};
    if(row.status==='running')out.running=item;
    else if(row.status==='partial')out.partial=item;
    else out.other.push(item);
    out.total_runs+=row.runs;
    out.missing_completion_runs+=row.no_completion_timestamp;
    out.temporal_article_matches+=row.articles_in_windows;
  }
  return out;
}
