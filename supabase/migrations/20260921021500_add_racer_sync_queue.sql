-- Queue recent racers so profile sync does not repeatedly scan the full entries table.
create table if not exists public.bs_racer_sync_queue (
  registration_no text primary key check (registration_no ~ '^[0-9]{5}$'),
  racer_name text,
  racer_name_kana text,
  racer_branch text,
  racer_class text,
  gender text,
  last_seen_date date not null,
  updated_at timestamptz not null default now()
);

alter table public.bs_racer_sync_queue enable row level security;
revoke all on table public.bs_racer_sync_queue from public, anon, authenticated;
grant all on table public.bs_racer_sync_queue to service_role;

create index if not exists bs_racer_sync_queue_last_seen_idx
  on public.bs_racer_sync_queue (last_seen_date desc, registration_no);

create or replace function public.bs_racer_sync_candidates(
  p_recent_days integer default 30,
  p_limit integer default 100
)
returns table (
  racer_registration_no text,
  racer_name text,
  racer_name_kana text,
  racer_branch text,
  racer_class text,
  gender text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    q.registration_no,
    q.racer_name,
    q.racer_name_kana,
    q.racer_branch,
    q.racer_class,
    q.gender
  from public.bs_racer_sync_queue q
  where q.last_seen_date >= current_date - greatest(p_recent_days,1)
    and not exists (
      select 1 from public.bs_racers r
      where r.registration_no=q.registration_no
    )
  order by q.last_seen_date desc, q.registration_no
  limit least(greatest(p_limit,1),500);
$$;

revoke all on function public.bs_racer_sync_candidates(integer,integer)
  from public, anon, authenticated;
grant execute on function public.bs_racer_sync_candidates(integer,integer)
  to service_role;
