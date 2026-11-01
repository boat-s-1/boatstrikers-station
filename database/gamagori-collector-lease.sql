-- PR294: isolated global lease. Existing chart rows and other systems are untouched.
create table public.bsc_gamagori_collector_lease (
  lock_name text primary key check (lock_name = 'gamagori-chart-collector'),
  owner uuid not null,
  lease_until timestamptz not null
);
alter table public.bsc_gamagori_collector_lease enable row level security;
revoke all on public.bsc_gamagori_collector_lease from public, anon, authenticated;
grant select, insert, update on public.bsc_gamagori_collector_lease to service_role;

create function public.bsc_gamagori_acquire_lease(p_owner uuid)
returns boolean language sql volatile security invoker set search_path = '' as $$
  with acquired as (
    insert into public.bsc_gamagori_collector_lease as l (lock_name, owner, lease_until)
    values ('gamagori-chart-collector', p_owner, clock_timestamp() + interval '120 seconds')
    on conflict (lock_name) do update
      set owner = excluded.owner, lease_until = excluded.lease_until
      where l.lease_until <= clock_timestamp()
    returning 1
  ) select exists(select 1 from acquired);
$$;

create function public.bsc_gamagori_release_lease(p_owner uuid)
returns boolean language sql volatile security invoker set search_path = '' as $$
  -- Keep a cooldown across API invocations; an old owner cannot release a new owner.
  with released as (
    update public.bsc_gamagori_collector_lease
      set lease_until = clock_timestamp() + interval '1500 milliseconds'
      where lock_name = 'gamagori-chart-collector' and owner = p_owner
    returning 1
  ) select exists(select 1 from released);
$$;
revoke all on function public.bsc_gamagori_acquire_lease(uuid) from public, anon, authenticated;
revoke all on function public.bsc_gamagori_release_lease(uuid) from public, anon, authenticated;
grant execute on function public.bsc_gamagori_acquire_lease(uuid) to service_role;
grant execute on function public.bsc_gamagori_release_lease(uuid) to service_role;
