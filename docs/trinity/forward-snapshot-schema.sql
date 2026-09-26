-- Review-only design. Do not apply to production until the TRINITY generation
-- workflow is ready to capture the actual input *before* prediction.
-- A schema migration must be created with the Supabase CLI at that stage.

create table public.trinity_prediction_snapshots (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null unique,
  generated_at timestamptz not null,
  source_captured_at timestamptz not null,
  race_date date not null,
  course_code smallint not null,
  race_no smallint not null check (race_no between 1 and 12),
  timing text not null check (timing in ('previous_day','after_exhibition')),
  feature_version text not null,
  model_version text not null,
  source text not null,
  -- Six full source feature vectors including average_st and gender/sex_code.
  -- Capture real source values here, not later reconstructed values.
  boat_features jsonb not null check (jsonb_typeof(boat_features)='array' and jsonb_array_length(boat_features)=6),
  ichika_scores jsonb not null,
  hatsune_scores jsonb not null,
  kiina_scores jsonb not null,
  trinity_probabilities jsonb not null,
  selected_tickets jsonb not null,
  recommendation text not null check (recommendation in ('buy','pass')),
  odds_snapshot_id bigint references public.bs_elimination_odds_snapshots(id),
  inserted_at timestamptz not null default now(),
  check (source_captured_at <= generated_at),
  check (inserted_at >= generated_at)
);

create index trinity_prediction_snapshots_race_idx
  on public.trinity_prediction_snapshots(race_date,course_code,race_no,timing,generated_at);

-- Results are separate so the prediction row never changes after publication.
create table public.trinity_snapshot_results (
  prediction_id uuid primary key references public.trinity_prediction_snapshots(prediction_id),
  result_trifecta text,
  result_payout integer,
  settled_at timestamptz not null default now()
);

create function public.block_trinity_snapshot_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'TRINITY prediction snapshots are append only';
end;
$$;

create trigger block_trinity_snapshot_update_delete
  before update or delete on public.trinity_prediction_snapshots
  for each row execute function public.block_trinity_snapshot_mutation();

create trigger block_trinity_snapshot_truncate
  before truncate on public.trinity_prediction_snapshots
  for each statement execute function public.block_trinity_snapshot_mutation();

alter table public.trinity_prediction_snapshots enable row level security;
alter table public.trinity_snapshot_results enable row level security;
revoke all on public.trinity_prediction_snapshots from anon,authenticated;
revoke all on public.trinity_snapshot_results from anon,authenticated;
grant select,insert on public.trinity_prediction_snapshots to service_role;
grant select,insert on public.trinity_snapshot_results to service_role;

-- Before applying: add a DB-side validation of the official closing time and,
-- if odds are used, verify odds.captured_at <= generated_at for the same race.
-- Never accept a client-supplied generated_at as proof by itself.
