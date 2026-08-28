-- Deployment source. Apply through the connected migration service; no race/notification data is changed.
create table public.bs_exhibition_acquisition_status (
  race_date date not null,
  course_code smallint not null check (course_code between 1 and 24),
  race_no smallint not null check (race_no between 1 and 12),
  consumer text not null check (consumer in ('kiina','ichika','hatsune')),
  started_at timestamptz not null,
  checked_at timestamptz not null,
  reason_code text not null check (reason_code in ('ready','not_published','timeout','network','http','date_mismatch','identity_mismatch','identity_missing','incomplete_boats','incomplete_values','layout','unsupported','invalid_request','unavailable','unknown')),
  source_kind text not null check (source_kind in ('official','boaters','unknown')),
  source_results jsonb not null default '[]'::jsonb check (jsonb_typeof(source_results) = 'array' and jsonb_array_length(source_results) <= 5),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_failure_code text,
  primary key (race_date,course_code,race_no,consumer),
  check (checked_at >= started_at)
);
comment on table public.bs_exhibition_acquisition_status is 'Latest fetch result per race/consumer, retaining last success and failure. Not evidence of DB save or notification. No raw upstream content.';
alter table public.bs_exhibition_acquisition_status enable row level security;
revoke all on public.bs_exhibition_acquisition_status from public, anon, authenticated;
grant select, insert, update on public.bs_exhibition_acquisition_status to service_role;

create function public.bs_record_exhibition_acquisition(p_record jsonb)
returns void language sql security invoker set search_path = pg_catalog as $$
  insert into public.bs_exhibition_acquisition_status as existing
    (race_date,course_code,race_no,consumer,started_at,checked_at,reason_code,source_kind,source_results,last_success_at,last_failure_at,last_failure_code)
  values (
    (p_record->>'race_date')::date, (p_record->>'course_code')::smallint,
    (p_record->>'race_no')::smallint, p_record->>'consumer',
    (p_record->>'started_at')::timestamptz, (p_record->>'checked_at')::timestamptz,
    p_record->>'reason_code', p_record->>'source_kind', coalesce(p_record->'source_results','[]'::jsonb),
    case when p_record->>'reason_code' = 'ready' then (p_record->>'checked_at')::timestamptz end,
    case when p_record->>'reason_code' <> 'ready' then (p_record->>'checked_at')::timestamptz end,
    case when p_record->>'reason_code' <> 'ready' then p_record->>'reason_code' end
  )
  on conflict (race_date,course_code,race_no,consumer) do update set
    started_at = excluded.started_at, checked_at = excluded.checked_at,
    reason_code = excluded.reason_code, source_kind = excluded.source_kind, source_results = excluded.source_results,
    last_success_at = coalesce(excluded.last_success_at,existing.last_success_at),
    last_failure_at = coalesce(excluded.last_failure_at,existing.last_failure_at),
    last_failure_code = coalesce(excluded.last_failure_code,existing.last_failure_code)
  -- A slow older request must not replace a newer attempt's result.
  where excluded.started_at > existing.started_at
    or (excluded.started_at = existing.started_at and excluded.checked_at > existing.checked_at);
$$;
revoke all on function public.bs_record_exhibition_acquisition(jsonb) from public, anon, authenticated;
grant execute on function public.bs_record_exhibition_acquisition(jsonb) to service_role;
