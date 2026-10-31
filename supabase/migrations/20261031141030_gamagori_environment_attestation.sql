-- Environment attestation; no project identity or trust is granted by migration alone.
create table public.bsc_gamagori_environment_identity(
 singleton boolean primary key default true check(singleton),project_ref text not null check(project_ref ~ '^[a-z]{20}$'),
 stage text not null check(stage='isolated'),meeting_source_hash text not null check(meeting_source_hash ~ '^[a-f0-9]{64}$'),
 expected_column_signatures jsonb not null,created_at timestamptz not null default clock_timestamp()
);
alter table public.bsc_gamagori_environment_identity enable row level security;
revoke all on public.bsc_gamagori_environment_identity from public,anon,authenticated,service_role;
grant select on public.bsc_gamagori_environment_identity to service_role;
create function public.bsc_gamagori_environment_attestation() returns jsonb language sql stable security invoker set search_path='' as $$
 with identity as(select * from public.bsc_gamagori_environment_identity where singleton),
 meeting as(select p.prosrc from pg_proc p where p.oid=to_regprocedure('public.bsc_gamagori_meeting_evidence(date)')),
 actual as(select c.relname,encode(sha256(convert_to(string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||a.attidentity::text||':'||a.attgenerated::text,'|' order by a.attnum),'UTF8')),'hex') signature
 from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
 where n.nspname='public' and c.relname in('bs_race_events','bs_race_entries','bs_race_results','bs_live_source_sync_logs','bsc_gamagori_chart_ratings','bsc_gamagori_collection_days','bsc_gamagori_collection_runs','bsc_gamagori_collection_tasks','bsc_gamagori_collector_lease') group by c.relname)
 select jsonb_build_object('project_ref',i.project_ref,'stage',i.stage,
  'fixture_references',coalesce(m.prosrc ~* '(fixture|phase13_archive)',true),
  'authoritative_meeting_rpc',coalesce(encode(sha256(convert_to(m.prosrc,'UTF8')),'hex')=i.meeting_source_hash,false),
  'collector_read_schema_matches',(select count(*)=9 and bool_and(a.signature=e.value) from jsonb_each_text(i.expected_column_signatures) e join actual a on a.relname=e.key),
  'shared_source_writes_disabled',not exists(select 1 from unnest(array['bs_race_events','bs_race_entries','bs_race_results','bs_live_source_sync_logs']) t where has_table_privilege('service_role','public.'||t,'INSERT') or has_table_privilege('service_role','public.'||t,'UPDATE') or has_table_privilege('service_role','public.'||t,'DELETE')),
  'scope','collector_read_contract; source writer triggers and schedules excluded') from identity i left join meeting m on true;
$$;
revoke all on function public.bsc_gamagori_environment_attestation() from public,anon,authenticated;
grant execute on function public.bsc_gamagori_environment_attestation() to service_role;
