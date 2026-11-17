do $$
declare
  source_command text;
begin
  if not exists (select 1 from cron.job where jobname = 'ichika-escape-surge-line') then
    select replace(command, '/api/cron/ichika-hidden-escape', '/api/cron/ichika-escape-surge')
      into source_command
      from cron.job
      where jobid = 4;
    if source_command is null then
      raise exception 'source Ichika cron job not found';
    end if;
    perform cron.schedule('ichika-escape-surge-line', '*/2 * * * *', source_command);
  end if;
end $$;