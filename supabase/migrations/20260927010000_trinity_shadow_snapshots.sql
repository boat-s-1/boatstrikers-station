-- Future-only evidence; no backfilled or reconstructed predictions are accepted.
create table public.trinity_prediction_snapshots (
  prediction_id uuid primary key,
  generated_at timestamptz not null,
  source_captured_at timestamptz not null,
  inserted_at timestamptz not null default clock_timestamp(),
  race_date date not null,
  course_code smallint not null,
  race_no smallint not null check (race_no between 1 and 12),
  timing text not null check (timing in ('previous_day','after_exhibition')),
  engine_version text not null check (engine_version in ('trinity-core-v2','trinity-v3-candidate-01')),
  feature_version text not null,
  source_version text not null,
  boat_features jsonb not null check (jsonb_typeof(boat_features) = 'array' and jsonb_array_length(boat_features) = 6),
  ichika_scores jsonb not null,
  hatsune_scores jsonb not null,
  kiina_scores jsonb not null,
  trinity_scores jsonb not null,
  first_probabilities jsonb not null,
  second_probabilities jsonb not null,
  third_probabilities jsonb not null,
  top_combination text,
  top_combination_probability double precision,
  selected_tickets jsonb not null check (jsonb_typeof(selected_tickets) = 'array'),
  ticket_count integer not null check (ticket_count between 0 and 5),
  investment_yen integer not null check (investment_yen >= 0),
  recommendation text not null check (recommendation in ('BUY','PASS')),
  strategy_tag text not null,
  selection_reason text not null,
  women_race boolean not null,
  odds_snapshot_id bigint references public.bs_elimination_odds_snapshots(id),
  odds_captured_at timestamptz,
  market_implied_probability double precision,
  trinity_probability double precision,
  edge double precision,
  expected_value double precision,
  unique (race_date,course_code,race_no,timing,engine_version),
  check (source_captured_at <= generated_at and generated_at <= inserted_at),
  check ((recommendation = 'PASS' and ticket_count = 0 and investment_yen = 0) or
    (recommendation = 'BUY' and ticket_count > 0 and investment_yen > 0)),
  check (ticket_count = jsonb_array_length(selected_tickets)),
  check ((odds_snapshot_id is null and odds_captured_at is null) or
    (odds_snapshot_id is not null and odds_captured_at is not null and odds_captured_at <= source_captured_at))
);
create index trinity_shadow_race_idx on public.trinity_prediction_snapshots (race_date, timing, generated_at);

create table public.trinity_prediction_results (
  prediction_id uuid primary key references public.trinity_prediction_snapshots(prediction_id),
  race_date date not null,
  course_code smallint not null,
  race_no smallint not null,
  actual_trifecta text not null,
  trifecta_payout integer not null check (trifecta_payout >= 0),
  hit boolean not null,
  payout_yen integer not null check (payout_yen >= 0),
  profit_yen integer not null,
  settled_at timestamptz not null default clock_timestamp()
);

create function public.trinity_shadow_guard() returns trigger language plpgsql set search_path = '' as $$
declare deadline timestamptz;
declare available boolean;
declare odds_record record;
declare one_boat jsonb;
begin
  if tg_op <> 'INSERT' then
    raise exception 'TRINITY shadow evidence is immutable';
  end if;
  if tg_table_name = 'trinity_prediction_snapshots' then
    select (e.race_date::timestamp + e.closing_time::time) at time zone 'Asia/Tokyo', e.result_available
      into deadline, available from public.bs_race_events e
      where e.race_date = new.race_date and e.course_code = new.course_code and e.race_no = new.race_no;
    if deadline is null or deadline <= new.generated_at or deadline <= clock_timestamp() or available is distinct from false then
      raise exception 'prediction must be generated and inserted before closing and result availability';
    end if;
    for one_boat in select value from jsonb_array_elements(new.boat_features) loop
      if one_boat->>'racer_registration_no' is null or one_boat->>'racer_name' is null or
        one_boat->>'average_st' is null or one_boat->>'national_win_rate' is null or
        one_boat->>'local_win_rate' is null or one_boat->>'motor_2_rate' is null or
        one_boat->>'boat_2_rate' is null or one_boat->>'boat_no' is null or
        (one_boat->>'sex_code' is null and one_boat->>'gender' is null and one_boat->>'gender_code' is null) then
        raise exception 'incomplete immutable feature vector';
      end if;
      if new.timing = 'previous_day' and (one_boat ? 'exhibition_time' or one_boat ? 'exhibition_st' or
         one_boat ? 'lap_time' or one_boat ? 'turn_time' or one_boat ? 'straight_time' or one_boat ? 'exhibition_course') then
        raise exception 'previous_day cannot carry exhibition features';
      end if;
      if new.timing = 'after_exhibition' and (one_boat->>'exhibition_time' is null or one_boat->>'exhibition_st' is null) then
        raise exception 'after_exhibition requires six observed exhibition records';
      end if;
    end loop;
    if new.odds_snapshot_id is not null then
      select o.race_date, o.course_code, o.race_no, o.captured_at into odds_record
      from public.bs_elimination_odds_snapshots o where o.id = new.odds_snapshot_id;
      if odds_record.race_date is distinct from new.race_date or odds_record.course_code is distinct from new.course_code or
        odds_record.race_no is distinct from new.race_no or odds_record.captured_at is distinct from new.odds_captured_at or
        odds_record.captured_at > new.source_captured_at then
        raise exception 'odds source must be historical and belong to this race';
      end if;
    end if;
  else
    if not exists (select 1 from public.bs_race_results r where r.race_date = new.race_date
       and r.course_code = new.course_code and r.race_no = new.race_no
       and regexp_replace(coalesce(r.winning_trifecta, r.trifecta_result, ''), '[^1-6]', '', 'g') =
           regexp_replace(new.actual_trifecta, '[^1-6]', '', 'g')
       and r.trifecta_payout = new.trifecta_payout) then
      raise exception 'settlement requires a matching recorded official result';
    end if;
  end if;
  return new;
end;
$$;
create trigger trinity_shadow_insert_guard before insert on public.trinity_prediction_snapshots
 for each row execute function public.trinity_shadow_guard();
create trigger trinity_shadow_results_guard before insert on public.trinity_prediction_results
 for each row execute function public.trinity_shadow_guard();
create trigger trinity_shadow_immutable before update or delete on public.trinity_prediction_snapshots
 for each row execute function public.trinity_shadow_guard();
create trigger trinity_shadow_results_immutable before update or delete on public.trinity_prediction_results
 for each row execute function public.trinity_shadow_guard();
create trigger trinity_shadow_no_truncate before truncate on public.trinity_prediction_snapshots
 for each statement execute function public.trinity_shadow_guard();
create trigger trinity_shadow_results_no_truncate before truncate on public.trinity_prediction_results
 for each statement execute function public.trinity_shadow_guard();
alter table public.trinity_prediction_snapshots enable row level security;
alter table public.trinity_prediction_results enable row level security;
revoke all on public.trinity_prediction_snapshots, public.trinity_prediction_results from anon, authenticated;
grant select, insert on public.trinity_prediction_snapshots, public.trinity_prediction_results to service_role;
