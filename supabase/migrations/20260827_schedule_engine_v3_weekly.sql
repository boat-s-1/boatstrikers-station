do $$
declare
  v_jobid bigint;
begin
  select jobid
    into v_jobid
  from cron.job
  where jobname = 'boatstrikers-engine-v3-weekly'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'boatstrikers-engine-v3-weekly',
    '0 19 * * 0',
    $cron$
      select *
      from public.bs_engine_v3_refresh_all(current_date);
    $cron$
  );
end
$$;
