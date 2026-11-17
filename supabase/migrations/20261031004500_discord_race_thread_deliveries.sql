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

-- Atomic claim: only pending rows may be claimed. A sending/unknown row
-- cannot be re-claimed automatically after a timeout or process crash.
create or replace function public.bs_claim_discord_race_delivery(
  p_race_date date, p_course_code text, p_race_no integer, p_message_key text
) returns boolean language plpgsql security invoker set search_path = public as $$
declare v_id bigint;
begin
  insert into public.bs_discord_race_thread_deliveries
    (race_date,course_code,race_no,message_key,state)
  values (p_race_date,p_course_code,p_race_no,p_message_key,'pending')
  on conflict (race_date,course_code,race_no,message_key) do nothing;

  update public.bs_discord_race_thread_deliveries
  set state='sending',attempt_count=attempt_count+1,claimed_at=now(),updated_at=now()
  where race_date=p_race_date and course_code=p_course_code
    and race_no=p_race_no and message_key=p_message_key and state='pending'
  returning id into v_id;
  return v_id is not null;
end;
$$;
revoke all on function public.bs_claim_discord_race_delivery(date,text,integer,text) from public,anon,authenticated;
grant execute on function public.bs_claim_discord_race_delivery(date,text,integer,text) to service_role;
