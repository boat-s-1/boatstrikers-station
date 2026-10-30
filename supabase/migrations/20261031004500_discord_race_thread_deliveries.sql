-- Draft only. Do not apply until race-thread writer is updated and tested.
-- One record per race and message stage; do not expose to anon/authenticated.
create table if not exists public.bs_discord_race_thread_deliveries (
  id bigint generated always as identity primary key,
  race_date date not null,
  course_code text not null,
  race_no integer not null check (race_no between 1 and 12),
  message_key text not null check (message_key in ('thread','starter','ichika','hatsune','kiina')),
  discord_thread_id text,
  discord_message_id text,
  state text not null default 'pending'
    check (state in ('pending','sending','sent','unknown','failed')),
  attempt_count integer not null default 0,
  last_error text,
  claimed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (race_date,course_code,race_no,message_key)
);
create index if not exists bs_discord_race_thread_deliveries_state_idx
  on public.bs_discord_race_thread_deliveries(state,updated_at);
alter table public.bs_discord_race_thread_deliveries enable row level security;
revoke all on public.bs_discord_race_thread_deliveries from anon,authenticated;
-- Do not automatically retry 'unknown' (the Discord POST may have succeeded).
-- Use an atomic claim before any external API request; store message IDs after success.
