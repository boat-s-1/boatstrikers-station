-- Public aggregate-only layer for AI bet performance.
-- Keeps raw tickets/prediction details in bs_ai_bet_results private.

create table if not exists public.bs_ai_bet_public_mode_stats (
  mode_key text primary key,
  mode_name text,
  race_count bigint not null default 0,
  hit_count bigint not null default 0,
  hit_rate numeric,
  investment bigint not null default 0,
  payout bigint not null default 0,
  profit bigint not null default 0,
  recovery_rate numeric,
  latest_settled_at timestamptz
);

create table if not exists public.bs_ai_bet_public_monthly_stats (
  month date not null,
  mode_key text not null,
  mode_name text,
  race_count bigint not null default 0,
  hit_count bigint not null default 0,
  hit_rate numeric,
  investment bigint not null default 0,
  payout bigint not null default 0,
  profit bigint not null default 0,
  recovery_rate numeric,
  latest_settled_at timestamptz,
  primary key (month, mode_key)
);

create table if not exists public.bs_ai_bet_public_course_stats (
  course_code integer not null,
  mode_key text not null,
  mode_name text,
  settled_count bigint not null default 0,
  hit_count bigint not null default 0,
  hit_rate numeric,
  investment bigint not null default 0,
  payout bigint not null default 0,
  profit bigint not null default 0,
  recovery_rate numeric,
  primary key (course_code, mode_key)
);

alter table public.bs_ai_bet_public_mode_stats enable row level security;
alter table public.bs_ai_bet_public_monthly_stats enable row level security;
alter table public.bs_ai_bet_public_course_stats enable row level security;

drop policy if exists "public read ai bet mode stats" on public.bs_ai_bet_public_mode_stats;
create policy "public read ai bet mode stats"
  on public.bs_ai_bet_public_mode_stats for select
  to anon, authenticated
  using (true);

drop policy if exists "public read ai bet monthly stats" on public.bs_ai_bet_public_monthly_stats;
create policy "public read ai bet monthly stats"
  on public.bs_ai_bet_public_monthly_stats for select
  to anon, authenticated
  using (true);

drop policy if exists "public read ai bet course stats" on public.bs_ai_bet_public_course_stats;
create policy "public read ai bet course stats"
  on public.bs_ai_bet_public_course_stats for select
  to anon, authenticated
  using (true);

revoke all on public.bs_ai_bet_public_mode_stats from anon, authenticated;
revoke all on public.bs_ai_bet_public_monthly_stats from anon, authenticated;
revoke all on public.bs_ai_bet_public_course_stats from anon, authenticated;
grant select on public.bs_ai_bet_public_mode_stats to anon, authenticated;
grant select on public.bs_ai_bet_public_monthly_stats to anon, authenticated;
grant select on public.bs_ai_bet_public_course_stats to anon, authenticated;
grant select, insert, update, delete on public.bs_ai_bet_public_mode_stats to service_role;
grant select, insert, update, delete on public.bs_ai_bet_public_monthly_stats to service_role;
grant select, insert, update, delete on public.bs_ai_bet_public_course_stats to service_role;

create or replace function public.bs_refresh_ai_bet_public_stats()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  truncate table public.bs_ai_bet_public_mode_stats;
  insert into public.bs_ai_bet_public_mode_stats
    (mode_key, mode_name, race_count, hit_count, hit_rate, investment, payout, profit, recovery_rate, latest_settled_at)
  select
    mode_key,
    coalesce(max(mode_name), mode_key) as mode_name,
    count(*) as race_count,
    count(*) filter (where coalesce(is_hit,false) = true) as hit_count,
    round(100.0 * count(*) filter (where coalesce(is_hit,false) = true)::numeric / nullif(count(*),0)::numeric, 2) as hit_rate,
    coalesce(sum(investment),0)::bigint as investment,
    coalesce(sum(payout),0)::bigint as payout,
    coalesce(sum(profit),0)::bigint as profit,
    round(100.0 * coalesce(sum(payout),0)::numeric / nullif(coalesce(sum(investment),0),0)::numeric, 2) as recovery_rate,
    max(settled_at) as latest_settled_at
  from public.bs_ai_bet_results
  group by mode_key;

  truncate table public.bs_ai_bet_public_monthly_stats;
  insert into public.bs_ai_bet_public_monthly_stats
    (month, mode_key, mode_name, race_count, hit_count, hit_rate, investment, payout, profit, recovery_rate, latest_settled_at)
  select
    date_trunc('month', race_date::timestamp with time zone)::date as month,
    mode_key,
    coalesce(max(mode_name), mode_key) as mode_name,
    count(*) as race_count,
    count(*) filter (where coalesce(is_hit,false) = true) as hit_count,
    round(100.0 * count(*) filter (where coalesce(is_hit,false) = true)::numeric / nullif(count(*),0)::numeric, 2) as hit_rate,
    coalesce(sum(investment),0)::bigint as investment,
    coalesce(sum(payout),0)::bigint as payout,
    coalesce(sum(profit),0)::bigint as profit,
    round(100.0 * coalesce(sum(payout),0)::numeric / nullif(coalesce(sum(investment),0),0)::numeric, 2) as recovery_rate,
    max(settled_at) as latest_settled_at
  from public.bs_ai_bet_results
  group by date_trunc('month', race_date::timestamp with time zone), mode_key;

  truncate table public.bs_ai_bet_public_course_stats;
  insert into public.bs_ai_bet_public_course_stats
    (course_code, mode_key, mode_name, settled_count, hit_count, hit_rate, investment, payout, profit, recovery_rate)
  select
    course_code,
    mode_key,
    max(mode_name) as mode_name,
    count(*) as settled_count,
    count(*) filter (where is_hit) as hit_count,
    round(100.0 * count(*) filter (where is_hit)::numeric / nullif(count(*),0)::numeric, 2) as hit_rate,
    sum(investment)::bigint as investment,
    sum(payout)::bigint as payout,
    sum(profit)::bigint as profit,
    round(100.0 * sum(payout)::numeric / nullif(sum(investment),0)::numeric, 2) as recovery_rate
  from public.bs_ai_bet_results
  group by course_code, mode_key;
end;
$$;

revoke all on function public.bs_refresh_ai_bet_public_stats() from public, anon, authenticated;
grant execute on function public.bs_refresh_ai_bet_public_stats() to service_role;

-- Initial snapshot
select public.bs_refresh_ai_bet_public_stats();

-- Keep public aggregates current whenever the raw results change.
create or replace function public.bs_ai_bet_public_stats_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.bs_refresh_ai_bet_public_stats();
  return null;
end;
$$;

revoke all on function public.bs_ai_bet_public_stats_trigger() from public, anon, authenticated;
grant execute on function public.bs_ai_bet_public_stats_trigger() to service_role;

drop trigger if exists trg_bs_ai_bet_public_stats_refresh on public.bs_ai_bet_results;
create trigger trg_bs_ai_bet_public_stats_refresh
after insert or update or delete on public.bs_ai_bet_results
for each statement execute function public.bs_ai_bet_public_stats_trigger();

-- Preserve the existing public API/view names, now backed only by aggregate tables.
create or replace view public.v_bs_ai_bet_mode_stats
with (security_invoker = true)
as
select mode_key, mode_name, race_count, hit_count, hit_rate,
       investment, payout, profit, recovery_rate, latest_settled_at
from public.bs_ai_bet_public_mode_stats;

create or replace view public.v_bs_ai_bet_monthly_stats
with (security_invoker = true)
as
select month, mode_key, mode_name, race_count, hit_count, hit_rate,
       investment, payout, profit, recovery_rate, latest_settled_at
from public.bs_ai_bet_public_monthly_stats;

create or replace view public.v_bs_ai_bet_course_stats
with (security_invoker = true)
as
select course_code, mode_key, mode_name, settled_count, hit_count, hit_rate,
       investment, payout, profit, recovery_rate
from public.bs_ai_bet_public_course_stats;

grant select on public.v_bs_ai_bet_mode_stats to anon, authenticated;
grant select on public.v_bs_ai_bet_monthly_stats to anon, authenticated;
grant select on public.v_bs_ai_bet_course_stats to anon, authenticated;
