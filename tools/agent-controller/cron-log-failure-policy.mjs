// Pure offline decision helper: logging is observability, not business transaction.
export function decideCronLogFailure({pipelineResult,logUpdateConfirmed}) {
  if(!['success','partial','error'].includes(pipelineResult)) throw Error('invalid pipeline result');
  if(typeof logUpdateConfirmed!=='boolean') throw Error('log confirmation required');
  return {
    pipeline_result:pipelineResult,
    log_persistence:logUpdateConfirmed?'confirmed':'unconfirmed',
    operator_review:!logUpdateConfirmed||pipelineResult!=='success',
    end_to_end_health:logUpdateConfirmed&&pipelineResult==='success'?'reported_success':'unknown',
    retry_pipeline:false,
    republish_news:false,
    mutate_cron_schedule:false,
    production_action:'none'
  };
}
