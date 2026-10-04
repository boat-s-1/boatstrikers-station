-- Operational setup, NOT an automatic production migration.
-- Only boatstrikers-blog-staging (usieipnicxzzwgrzngtt).
-- The staging-only marker must exist; it is never copied to production.
begin;
do $guard$
begin
 if not exists(select 1 from public.blog_tags where id='e61c7bd5-8c94-40dd-b7cc-dfeeb70fcef6' and slug='staging-test') then
  raise exception 'STOP: staging marker is missing; do not execute on production';
 end if;
end;
$guard$;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('blog-staging-publish-due','* * * * *',
 $job$begin; set local role service_role; set local statement_timeout='30s'; select public.blog_publish_due(20); commit;$job$);
commit;

-- Observe; never manually call the worker for the automatic acceptance test.
select jobid,jobname,schedule,active from cron.job where jobname='blog-staging-publish-due';
select runid,status,return_message,start_time,end_time from cron.job_run_details
 where jobid=(select jobid from cron.job where jobname='blog-staging-publish-due') order by runid desc limit 20;
-- Stop (reversible):
-- select cron.alter_job((select jobid from cron.job where jobname='blog-staging-publish-due'), active:=false);
-- No HTTP trigger, API key or new secret is required.
