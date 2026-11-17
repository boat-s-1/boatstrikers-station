alter table public.bs_race_results
  add column if not exists api_result_synced_at timestamptz,
  add column if not exists api_result_source text;

alter table public.bs_race_entries
  add column if not exists api_result_synced_at timestamptz;

create table if not exists public.bs_live_source_sync_logs (
  id bigserial primary key,
  source text not null,
  sync_kind text not null,
  race_date date,
  status text not null,
  entry_rows integer not null default 0,
  event_rows integer not null default 0,
  result_rows integer not null default 0,
  result_entry_rows integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  detail jsonb
);

create index if not exists bs_live_source_sync_logs_started_idx
  on public.bs_live_source_sync_logs (started_at desc);