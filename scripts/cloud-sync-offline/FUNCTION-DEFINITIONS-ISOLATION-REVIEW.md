# Function definitions for isolation review

Read from production pg_catalog on 2026-11-17. Reference only. Dependencies, ownership, grants and side effects require review before isolated execution. Do not run against production.

## bs_guard_exhibition_write()

```sql
CREATE OR REPLACE FUNCTION public.bs_guard_exhibition_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  new := jsonb_populate_record(new, public.bs_merge_exhibition_payload(
    case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end,
    to_jsonb(new), clock_timestamp()));
  return new;
end;
$function$

```

## bs_set_updated_at()

```sql
CREATE OR REPLACE FUNCTION public.bs_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$

```

## bs_reconcile_bootstrap_entry()

```sql
CREATE OR REPLACE FUNCTION public.bs_reconcile_bootstrap_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if old.data_source = 'BOATRACE_OPEN_API_BOOTSTRAP' then
    if new.data_source is distinct from old.data_source
       and new.data_source is not null
       and new.data_source <> 'BOATRACE_OPEN_API_BOOTSTRAP' then
      new.bootstrap_reconciled_at := coalesce(new.bootstrap_reconciled_at, now());
      return new;
    end if;

    if (old.current_series_results is null and new.current_series_results is not null)
       or (old.racer_name_kana is null and new.racer_name_kana is not null)
       or (old.sex_code is null and new.sex_code is not null)
       or (old.racer_branch is null and new.racer_branch is not null)
       or (old.motor_second_rate is null and new.motor_second_rate is not null)
       or (old.race_boat_second_rate is null and new.race_boat_second_rate is not null) then
      new.data_source := 'BRDB_RECONCILED';
      new.bootstrap_reconciled_at := coalesce(new.bootstrap_reconciled_at, now());
    end if;
  end if;
  return new;
end;
$function$

```

## bs_reconcile_bootstrap_event_after_entry()

```sql
CREATE OR REPLACE FUNCTION public.bs_reconcile_bootstrap_event_after_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if old.data_source = 'BOATRACE_OPEN_API_BOOTSTRAP'
     and new.data_source is distinct from 'BOATRACE_OPEN_API_BOOTSTRAP' then
    update public.bs_race_events e
    set data_source = 'BRDB_RECONCILED',
        bootstrap_reconciled_at = coalesce(e.bootstrap_reconciled_at, now()),
        updated_at = now()
    where e.race_date = new.race_date
      and e.course_code = new.course_code
      and e.race_no = new.race_no
      and e.data_source = 'BOATRACE_OPEN_API_BOOTSTRAP'
      and not exists (
        select 1
        from public.bs_race_entries x
        where x.race_date = new.race_date
          and x.course_code = new.course_code
          and x.race_no = new.race_no
          and x.data_source = 'BOATRACE_OPEN_API_BOOTSTRAP'
      );
  end if;
  return new;
end;
$function$

```

## bs_track_entry_first_seen()

```sql
CREATE OR REPLACE FUNCTION public.bs_track_entry_first_seen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.api_preview_synced_at is not null
     and (tg_op = 'INSERT' or old.api_preview_synced_at is distinct from new.api_preview_synced_at) then
    perform public.bs_record_first_seen(
      new.race_date,
      new.course_code,
      new.race_no,
      'exhibition',
      coalesce(nullif(new.api_preview_source,''), 'boatraceopenapi/v1'),
      new.api_preview_synced_at
    );
  end if;

  if new.exhibition_synced_at is not null
     and upper(coalesce(new.exhibition_source,'')) like '%PC-KYOTEI%'
     and (tg_op = 'INSERT' or old.exhibition_synced_at is distinct from new.exhibition_synced_at) then
    perform public.bs_record_first_seen(
      new.race_date,
      new.course_code,
      new.race_no,
      'exhibition',
      'PC-KYOTEI',
      new.exhibition_synced_at
    );
  end if;

  return new;
end;
$function$

```

## trigger_evaluate_ichika_escape_surge_alerts()

```sql
CREATE OR REPLACE FUNCTION public.trigger_evaluate_ichika_escape_surge_alerts()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.race_date = (now() at time zone 'Asia/Tokyo')::date then
    perform public.evaluate_ichika_escape_surge_alerts();
  end if;
  return new;
end;
$function$

```

## bs_settle_theory_recommendations_from_event()

```sql
CREATE OR REPLACE FUNCTION public.bs_settle_theory_recommendations_from_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
begin
  if new.trifecta is null then return new; end if;
  for r in
    select id from public.bs_theory_recommendations
    where race_date = new.race_date
      and course_code = new.course_code
      and race_no = new.race_no
      and status <> 'settled'
  loop
    perform public.bs_settle_theory_recommendation(r.id);
  end loop;
  return new;
end;
$function$

```

## bs_track_result_first_seen()

```sql
CREATE OR REPLACE FUNCTION public.bs_track_result_first_seen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.api_result_synced_at is not null
     and (tg_op = 'INSERT' or old.api_result_synced_at is distinct from new.api_result_synced_at) then
    perform public.bs_record_first_seen(
      new.race_date,
      new.course_code,
      new.race_no,
      'result',
      coalesce(nullif(new.api_result_source,''), 'boatraceopenapi/v1'),
      new.api_result_synced_at
    );
  end if;

  if new.synced_at is not null
     and new.api_result_synced_at is null
     and (tg_op = 'INSERT' or old.synced_at is distinct from new.synced_at) then
    perform public.bs_record_first_seen(
      new.race_date,
      new.course_code,
      new.race_no,
      'result',
      'PC-KYOTEI',
      new.synced_at
    );
  end if;

  return new;
end;
$function$

```

## bs_apply_openapi_bootstrap(jsonb,jsonb,timestamp with time zone)

```sql
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_bootstrap(p_events jsonb, p_entries jsonb, p_synced_at timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_event_inserted integer := 0;
  v_entry_inserted integer := 0;
begin
  with payload as (
    select
      (x->>'race_date')::date as race_date,
      (x->>'course_code')::smallint as course_code,
      (x->>'race_no')::smallint as race_no,
      nullif(x->>'course_name','')::text as course_name,
      nullif(x->>'race_name','')::text as race_name,
      nullif(x->>'closing_time','')::time as closing_time,
      nullif(x->>'distance','')::integer as distance,
      nullif(x->>'race_day_no','')::integer as race_day_no
    from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) x
  )
  insert into public.bs_race_events (
    id, race_date, course_code, race_no, course_name, race_name,
    deadline_time, closing_time, distance, race_day_no, race_status,
    program_available, api_synced_at, data_source,
    synced_at, created_at, updated_at
  )
  select
    -1 * (to_char(race_date, 'YYYYMMDD')::bigint * 10000 + course_code::bigint * 100 + race_no::bigint),
    race_date, course_code, race_no, course_name, race_name,
    closing_time, closing_time, distance, race_day_no, 'scheduled',
    true, p_synced_at, 'BOATRACE_OPEN_API_BOOTSTRAP',
    p_synced_at, p_synced_at, p_synced_at
  from payload
  where race_date is not null
    and course_code between 1 and 24
    and race_no between 1 and 12
  on conflict (race_date, course_code, race_no) do nothing;
  get diagnostics v_event_inserted = row_count;

  with payload as (
    select
      (x->>'race_date')::date as race_date,
      (x->>'course_code')::smallint as course_code,
      (x->>'race_no')::smallint as race_no,
      (x->>'boat_no')::smallint as boat_no,
      nullif(x->>'racer_registration_no','')::text as racer_registration_no,
      nullif(x->>'racer_name','')::text as racer_name,
      nullif(x->>'racer_class','')::text as racer_class,
      nullif(x->>'national_win_rate','')::numeric as national_win_rate,
      nullif(x->>'local_win_rate','')::numeric as local_win_rate,
      nullif(x->>'national_2_rate','')::numeric as national_2_rate,
      nullif(x->>'local_2_rate','')::numeric as local_2_rate,
      nullif(x->>'average_st','')::numeric as average_st,
      nullif(x->>'flying_count','')::smallint as flying_count,
      nullif(x->>'late_count','')::smallint as late_count,
      nullif(x->>'motor_no','')::smallint as motor_no,
      nullif(x->>'motor_2_rate','')::numeric as motor_2_rate,
      nullif(x->>'boat_machine_no','')::smallint as boat_machine_no,
      nullif(x->>'boat_2_rate','')::numeric as boat_2_rate,
      nullif(x->>'racer_weight','')::numeric as racer_weight
    from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) x
  )
  insert into public.bs_race_entries (
    id, race_date, course_code, race_no, boat_no,
    racer_registration_no, racer_name, racer_class,
    national_win_rate, local_win_rate, national_2_rate, local_2_rate,
    average_st, flying_count, late_count,
    motor_no, motor_number, motor_2_rate, motor_top2_rate,
    boat_machine_no, race_boat_number, boat_2_rate, race_boat_top2_rate,
    racer_weight, weight, data_source, api_synced_at,
    synced_at, created_at, updated_at
  )
  select
    -1 * (to_char(race_date, 'YYYYMMDD')::bigint * 100000 + course_code::bigint * 1000 + race_no::bigint * 10 + boat_no::bigint),
    race_date, course_code, race_no, boat_no,
    racer_registration_no, racer_name, racer_class,
    national_win_rate, local_win_rate, national_2_rate, local_2_rate,
    average_st, flying_count, late_count,
    motor_no, motor_no, motor_2_rate, motor_2_rate,
    boat_machine_no, boat_machine_no, boat_2_rate, boat_2_rate,
    racer_weight, racer_weight, 'BOATRACE_OPEN_API_BOOTSTRAP', p_synced_at,
    p_synced_at, p_synced_at, p_synced_at
  from payload
  where race_date is not null
    and course_code between 1 and 24
    and race_no between 1 and 12
    and boat_no between 1 and 6
  on conflict (race_date, course_code, race_no, boat_no) do nothing;
  get diagnostics v_entry_inserted = row_count;

  return jsonb_build_object(
    'event_inserted', v_event_inserted,
    'entry_inserted', v_entry_inserted,
    'received_events', jsonb_array_length(coalesce(p_events, '[]'::jsonb)),
    'received_entries', jsonb_array_length(coalesce(p_entries, '[]'::jsonb)),
    'synced_at', p_synced_at
  );
end;
$function$

```

## bs_record_first_seen(date,smallint,smallint,text,text,timestamp with time zone)

```sql
CREATE OR REPLACE FUNCTION public.bs_record_first_seen(p_race_date date, p_course_code smallint, p_race_no smallint, p_data_kind text, p_source text, p_seen_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if p_race_date is null or p_course_code is null or p_race_no is null
     or p_data_kind is null or p_source is null or p_seen_at is null then
    return;
  end if;

  insert into public.bs_source_first_seen(
    race_date, course_code, race_no, data_kind, source, first_seen_at
  ) values (
    p_race_date, p_course_code, p_race_no, p_data_kind, p_source, p_seen_at
  )
  on conflict (race_date, course_code, race_no, data_kind, source)
  do update set first_seen_at = least(public.bs_source_first_seen.first_seen_at, excluded.first_seen_at);
end;
$function$

```

## bs_settle_theory_recommendation(bigint)

```sql
CREATE OR REPLACE FUNCTION public.bs_settle_theory_recommendation(p_recommendation_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  rec public.bs_theory_recommendations%rowtype;
  ev record;
  hit boolean;
  paid integer;
begin
  select * into rec from public.bs_theory_recommendations where id = p_recommendation_id;
  if not found then return; end if;
  if rec.recommendation_type <> 'tickets' or rec.ticket_count <= 0 then
    update public.bs_theory_recommendations
      set status = 'no_ticket', updated_at = now()
      where id = p_recommendation_id;
    return;
  end if;

  select trifecta, trifecta_payout into ev
  from public.bs_race_events
  where race_date = rec.race_date
    and course_code = rec.course_code
    and race_no = rec.race_no
    and trifecta is not null
  limit 1;

  if not found or ev.trifecta is null then return; end if;

  hit := rec.tickets ? trim(ev.trifecta);
  paid := case when hit then round(coalesce(ev.trifecta_payout, 0) * rec.unit_stake / 100.0)::integer else 0 end;

  update public.bs_theory_recommendations
  set result_combination = trim(ev.trifecta),
      trifecta_payout = ev.trifecta_payout,
      is_hit = hit,
      payout = paid,
      profit = paid - investment,
      recovery_rate = case when investment > 0 then paid * 100.0 / investment else null end,
      status = 'settled',
      settled_at = now(),
      updated_at = now()
  where id = p_recommendation_id;
end;
$function$

```

## evaluate_ichika_escape_surge_alerts()

```sql
CREATE OR REPLACE FUNCTION public.evaluate_ichika_escape_surge_alerts()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  inserted_count integer := 0;
begin
  with today_entries as (
    select
      e.race_date,
      e.course_code,
      e.race_no,
      e.boat_no,
      coalesce(e.official_exhibition_time, e.exhibition_time) as exhibition_time,
      coalesce(e.official_lap, e.lap_time) as lap_time,
      e.national_win_rate,
      e.local_win_rate
    from public.bs_race_entries e
    where e.race_date = (now() at time zone 'Asia/Tokyo')::date
  ),
  race_ready as (
    select
      race_date,
      course_code,
      race_no,
      min(exhibition_time) as best_exhibition,
      min(lap_time) as best_lap
    from today_entries
    group by race_date, course_code, race_no
    having count(*) filter (where exhibition_time is not null and lap_time is not null) = 6
  ),
  qualifying as (
    select
      t.race_date,
      t.course_code,
      t.race_no,
      t.exhibition_time,
      t.lap_time
    from today_entries t
    join race_ready r
      on r.race_date = t.race_date
     and r.course_code = t.course_code
     and r.race_no = t.race_no
    where t.boat_no = 1
      and t.exhibition_time = r.best_exhibition
      and t.lap_time = r.best_lap
  ),
  recommended as (
    select distinct on (t.race_date, t.course_code, t.race_no)
      t.race_date,
      t.course_code,
      t.race_no,
      t.boat_no as recommended_second_boat,
      t.national_win_rate as recommended_second_national_win_rate
    from today_entries t
    join qualifying q
      on q.race_date = t.race_date
     and q.course_code = t.course_code
     and q.race_no = t.race_no
    where t.boat_no between 2 and 6
    order by
      t.race_date,
      t.course_code,
      t.race_no,
      t.national_win_rate desc nulls last,
      t.local_win_rate desc nulls last,
      t.boat_no asc
  ),
  inserted as (
    insert into public.bs_ichika_escape_surge_alerts (
      race_date,
      course_code,
      course_name,
      race_no,
      closing_time,
      exhibition_time,
      lap_time,
      recommended_second_boat,
      recommended_second_national_win_rate
    )
    select
      q.race_date,
      q.course_code,
      ev.course_name,
      q.race_no,
      coalesce(ev.closing_time, ev.deadline_time),
      q.exhibition_time,
      q.lap_time,
      rec.recommended_second_boat,
      rec.recommended_second_national_win_rate
    from qualifying q
    left join public.bs_race_events ev
      on ev.race_date = q.race_date
     and ev.course_code = q.course_code
     and ev.race_no = q.race_no
    left join recommended rec
      on rec.race_date = q.race_date
     and rec.course_code = q.course_code
     and rec.race_no = q.race_no
    on conflict (race_date, course_code, race_no) do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$function$

```
