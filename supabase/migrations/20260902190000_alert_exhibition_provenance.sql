-- Preserve the exhibition data provenance used when an alert is created.
-- Latencies are derived from exhibition_synced_at -> detected_at -> notified_at.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'bs_exhibition_alerts',
    'bs_ichika_hidden_escape_alerts',
    'bs_hatsune_womens_inner_break_alerts',
    'bs_hatsune_box_alerts'
  ] loop
    execute format('alter table public.%I add column if not exists exhibition_source_kind text', target_table);
    execute format('alter table public.%I add column if not exists exhibition_source_detail jsonb not null default ''{}''::jsonb', target_table);
    execute format('alter table public.%I add column if not exists exhibition_synced_at timestamptz', target_table);
  end loop;
end $$;

create or replace function public.bs_stamp_alert_exhibition_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  entry_count integer := 0;
  metric_sources text[] := array[]::text[];
  latest_sync timestamptz;
  has_normal_exhibition boolean := false;
  has_pc boolean := false;
  has_non_pc boolean := false;
  has_kiryu boolean := false;
begin
  select
    count(distinct entry.boat_no),
    coalesce(array_agg(distinct source_name) filter (where source_name is not null), array[]::text[]),
    max(source_time),
    bool_or(entry.exhibition_time is not null)
  into entry_count, metric_sources, latest_sync, has_normal_exhibition
  from public.bs_race_entries entry
  left join lateral (
    select
      nullif(trim(metric.value ->> 'source'), '') as source_name,
      case
        when (metric.value ->> 'updated_at') ~ '^\\d{4}-\\d{2}-\\d{2}T'
          then (metric.value ->> 'updated_at')::timestamptz
        else null
      end as source_time
    from jsonb_each(coalesce(entry.exhibition_field_meta, '{}'::jsonb)) metric
    where metric.key in ('official_exhibition_time', 'official_lap', 'official_turn', 'official_straight')
      and metric.value ->> 'value' is not null
    union all
    select nullif(trim(entry.official_exhibition_source), ''), entry.official_exhibition_synced_at
    where entry.official_exhibition_source is not null
  ) source_fields on true
  where entry.race_date = new.race_date
    and entry.course_code = new.course_code
    and entry.race_no = new.race_no;

  select
    coalesce(bool_or(source ilike '%PC-KYOTEI%'), false),
    coalesce(bool_or(source not ilike '%PC-KYOTEI%'), false),
    coalesce(bool_or(source ilike '%KIRYU%'), false)
  into has_pc, has_non_pc, has_kiryu
  from unnest(metric_sources) source;

  new.exhibition_source_kind := case
    when entry_count <> 6 then 'unknown'
    when has_kiryu then 'kiryu_official_rank'
    when has_pc and has_non_pc then 'mixed'
    when has_pc then 'pc_kyotei'
    when has_non_pc then 'official'
    when has_normal_exhibition then 'normal_only'
    else 'unknown'
  end;
  new.exhibition_synced_at := latest_sync;
  new.exhibition_source_detail := jsonb_build_object(
    'entry_count', entry_count,
    'sources', to_jsonb(metric_sources),
    'recorded_at', clock_timestamp()
  );
  return new;
end;
$$;

do $$
declare
  target_table text;
  trigger_name text;
begin
  foreach target_table in array array[
    'bs_exhibition_alerts',
    'bs_ichika_hidden_escape_alerts',
    'bs_hatsune_womens_inner_break_alerts',
    'bs_hatsune_box_alerts'
  ] loop
    trigger_name := target_table || '_stamp_exhibition_provenance';
    execute format('drop trigger if exists %I on public.%I', trigger_name, target_table);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.bs_stamp_alert_exhibition_provenance()',
      trigger_name,
      target_table
    );
  end loop;
end $$;
