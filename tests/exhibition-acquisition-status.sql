-- Integration assertions. All fixture writes are rolled back; no race or LINE tables touched.
begin;
do $$
declare role_name text; operation text;
begin
  if not (select relrowsecurity from pg_class where oid='public.bs_exhibition_acquisition_status'::regclass) then raise exception 'RLS missing'; end if;
  foreach role_name in array array['anon','authenticated'] loop
    foreach operation in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if has_table_privilege(role_name,'public.bs_exhibition_acquisition_status',operation) then raise exception 'unexpected client table grant'; end if;
    end loop;
    if has_function_privilege(role_name,'public.bs_record_exhibition_acquisition(jsonb)','EXECUTE') then raise exception 'unexpected client RPC grant'; end if;
  end loop;
end $$;
set local role service_role;
select public.bs_record_exhibition_acquisition('{"race_date":"2099-12-31","course_code":24,"race_no":12,"consumer":"kiina","started_at":"2099-12-31T01:00:00Z","checked_at":"2099-12-31T01:00:01Z","reason_code":"timeout","source_kind":"official"}');
select public.bs_record_exhibition_acquisition('{"race_date":"2099-12-31","course_code":24,"race_no":12,"consumer":"kiina","started_at":"2099-12-31T01:01:00Z","checked_at":"2099-12-31T01:01:01Z","reason_code":"ready","source_kind":"official"}');
-- Older request finishing late must not overwrite the recovery.
select public.bs_record_exhibition_acquisition('{"race_date":"2099-12-31","course_code":24,"race_no":12,"consumer":"kiina","started_at":"2099-12-31T01:00:30Z","checked_at":"2099-12-31T01:02:01Z","reason_code":"network","source_kind":"official"}');
do $$
declare r public.bs_exhibition_acquisition_status;
begin
 select * into strict r from public.bs_exhibition_acquisition_status where race_date='2099-12-31' and course_code=24 and race_no=12 and consumer='kiina';
 if r.reason_code<>'ready' or r.last_failure_code<>'timeout' or r.last_success_at<>'2099-12-31T01:01:01Z'::timestamptz then raise exception 'recovery or ordering failed'; end if;
 begin
  perform public.bs_record_exhibition_acquisition('{"race_date":"2099-12-31","course_code":25,"race_no":12,"consumer":"kiina","started_at":"2099-12-31T01:00:00Z","checked_at":"2099-12-31T01:00:01Z","reason_code":"ready","source_kind":"official"}');
  raise exception 'invalid course accepted';
 exception when check_violation then null;
 end;
end $$;
rollback;
select 'acquisition status assertions passed; all fixture writes rolled back' as result;
