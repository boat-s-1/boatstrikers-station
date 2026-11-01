-- TEST BOOTSTRAP ONLY. Never apply this file to production.
-- Minimal chart schema + explicit fixture implementation of the existing evidence RPC.
create table public.bsc_gamagori_chart_ratings (
 race_date date not null,race_no smallint not null check(race_no between 1 and 12),boat_no smallint not null check(boat_no between 1 and 6),
 slit_rating smallint not null check(slit_rating between 1 and 5),turn_rating smallint not null check(turn_rating between 1 and 5),
 arrow_direction text not null check(arrow_direction in ('none','up','down')),source_url text not null,captured_at timestamptz not null default clock_timestamp(),
 primary key(race_date,race_no,boat_no)
);
alter table public.bsc_gamagori_chart_ratings enable row level security;
revoke all on public.bsc_gamagori_chart_ratings from public,anon,authenticated,service_role;
grant select,insert on public.bsc_gamagori_chart_ratings to service_role;
create table public.bsc_gamagori_phase13_fixture_events(race_date date primary key,payload jsonb not null);
alter table public.bsc_gamagori_phase13_fixture_events enable row level security;
revoke all on public.bsc_gamagori_phase13_fixture_events from public,anon,authenticated,service_role;
grant select on public.bsc_gamagori_phase13_fixture_events to service_role;
create function public.bsc_gamagori_meeting_evidence(p_date date) returns jsonb language sql security invoker set search_path='' as $$select payload from public.bsc_gamagori_phase13_fixture_events where race_date=p_date$$;
revoke all on function public.bsc_gamagori_meeting_evidence(date) from public,anon,authenticated;
grant execute on function public.bsc_gamagori_meeting_evidence(date) to service_role;
