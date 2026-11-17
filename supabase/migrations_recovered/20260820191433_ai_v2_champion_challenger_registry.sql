-- BoatStrikers AI v2 Champion/Challenger registry support.

alter table public.ai_v2_predictions
  add column if not exists model_versions jsonb not null default '{}'::jsonb,
  add column if not exists data_cutoff_at timestamptz;

alter table public.ai_v2_daily_rankings
  add column if not exists data_timing text not null default 'previous_day';

alter table public.ai_v2_daily_rankings
  drop constraint if exists ai_v2_daily_rankings_ranking_date_ranking_type_rank_no_key;

drop index if exists public.ai_v2_daily_rankings_ranking_date_ranking_type_rank_no_key;

create unique index if not exists ai_v2_daily_rankings_unique_timing_idx
  on public.ai_v2_daily_rankings (ranking_date, data_timing, ranking_type, rank_no);

alter table public.ai_v2_daily_rankings
  drop constraint if exists ai_v2_daily_rankings_data_timing_check;

alter table public.ai_v2_daily_rankings
  add constraint ai_v2_daily_rankings_data_timing_check
  check (data_timing in ('previous_day','after_exhibition'));

create table if not exists public.ai_v2_model_slots (
  prediction_target text not null,
  data_timing text not null check (data_timing in ('previous_day','after_exhibition')),
  champion_source text not null default 'legacy',
  champion_model_version text,
  challenger_model_version text references public.ai_v2_models(model_version) on update cascade,
  promotion_status text not null default 'shadow'
    check (promotion_status in ('shadow','ready','promoted','blocked')),
  promotion_metrics jsonb not null default '{}'::jsonb,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (prediction_target, data_timing)
);

create index if not exists ai_v2_model_slots_challenger_idx
  on public.ai_v2_model_slots (challenger_model_version);

comment on table public.ai_v2_model_slots is
  'Tracks incumbent Champion and AI v2 Challenger per prediction target/timing without switching production automatically.';

comment on column public.ai_v2_predictions.model_versions is
  'Per-head model versions used for this prediction bundle, e.g. first/second/third/ichika/hatsune/kiina.';

comment on column public.ai_v2_predictions.data_cutoff_at is
  'Latest data timestamp allowed for this inference run; used to audit leakage/cutoff.';
