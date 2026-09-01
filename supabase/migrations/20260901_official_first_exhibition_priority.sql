-- Official venue measurements outrank PC-KYOTEI and secondary sources.
-- Missing fields remain fillable by the highest available valid fallback.
set lock_timeout = '3s';
alter table public.bs_race_entries add column if not exists exhibition_field_meta jsonb not null default '{}'::jsonb;

create or replace function public.bs_merge_exhibition_payload(p_old jsonb, p_new jsonb, p_now timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog
as $fn$
declare
  result jsonb := p_new;
  meta jsonb := coalesce(p_old->'exhibition_field_meta', '{}'::jsonb);
  fields text[] := array['official_exhibition_time','official_lap','official_turn','official_straight','official_half_lap','exhibition_time','lap_time','turn_time','straight_time','half_lap_time','api_exhibition_time','official_exhibition_st','exhibition_st','api_exhibition_st','official_exhibition_course','exhibition_course','api_exhibition_course'];
  field text; group_name text; clock_field text; source_field text;
  old_value numeric; new_value numeric; old_valid boolean; new_valid boolean;
  old_time timestamptz; new_time timestamptz; stale boolean;
  accepted jsonb := '{}'::jsonb; source_name text; old_source_name text;
  new_priority integer; old_priority integer; field_accepted boolean;
begin
  -- A different race/boat/racer must never inherit an old exhibition.
  if p_old <> '{}'::jsonb and (
    (p_old->>'race_date',p_old->>'course_code',p_old->>'race_no',p_old->>'boat_no') is distinct from
    (p_new->>'race_date',p_new->>'course_code',p_new->>'race_no',p_new->>'boat_no')
    or (nullif(p_old->>'racer_registration_no','') is not null and nullif(p_new->>'racer_registration_no','') is not null
      and p_old->>'racer_registration_no' <> p_new->>'racer_registration_no')
  ) then
    foreach field in array fields || array['official_exhibition_symbol','exhibition_fl','official_exhibition_source','official_exhibition_synced_at','exhibition_source','exhibition_synced_at','api_preview_source','api_preview_synced_at'] loop
      result := jsonb_set(result, array[field], 'null'::jsonb);
    end loop;
    return jsonb_set(result, '{exhibition_field_meta}', '{}'::jsonb);
  end if;

  foreach field in array fields loop
    field_accepted := false;
    group_name := case when field like 'official_%' then 'official' when field like 'api_%' then 'api' else 'general' end;
    clock_field := case group_name when 'official' then 'official_exhibition_synced_at' when 'api' then 'api_preview_synced_at' else 'exhibition_synced_at' end;
    source_field := case group_name when 'official' then 'official_exhibition_source' when 'api' then 'api_preview_source' else 'exhibition_source' end;
    old_time := nullif(p_old->>clock_field,'')::timestamptz;
    new_time := nullif(p_new->>clock_field,'')::timestamptz;
    stale := old_time is not null and new_time is not null and new_time < old_time;
    old_value := case when coalesce(p_old->>field,'') ~ '^[-+]?[0-9]+([.][0-9]+)?$' then (p_old->>field)::numeric else null end;
    new_value := case when coalesce(p_new->>field,'') ~ '^[-+]?[0-9]+([.][0-9]+)?$' then (p_new->>field)::numeric else null end;
    if field like '%_st' then
      old_valid := old_value between -1 and 10; new_valid := new_value between -1 and 10;
    elsif field like '%_course' then
      old_valid := old_value between 1 and 6 and old_value=trunc(old_value); new_valid := new_value between 1 and 6 and new_value=trunc(new_value);
    else
      old_valid := old_value > 0; new_valid := new_value > 0;
    end if;
    old_valid := coalesce(old_valid,false); new_valid := coalesce(new_valid,false);
    if old_valid and not (meta ? field) then
      meta := jsonb_set(meta,array[field],jsonb_build_object('value',old_value,'source',coalesce(p_old->>source_field,p_old->>'data_source','unknown'),'updated_at',old_time));
    end if;
    source_name := coalesce(nullif(p_new->>source_field,''),nullif(p_new->>'data_source',''),'unknown');
    old_source_name := coalesce(nullif(meta->field->>'source',''),nullif(p_old->>source_field,''),nullif(p_old->>'data_source',''),'unknown');
    new_priority := case
      when source_name ~* 'pc[-_ ]?ky(o|ou)?tei' then 300
      when source_name ilike '%official%' or source_name='公式' then 400
      when source_name ilike '%boaters%' then 200
      when source_name ilike '%api%' then 100 else 0 end;
    old_priority := case
      when old_source_name ~* 'pc[-_ ]?ky(o|ou)?tei' then 300
      when old_source_name ilike '%official%' or old_source_name='公式' then 400
      when old_source_name ilike '%boaters%' then 200
      when old_source_name ilike '%api%' then 100 else 0 end;
    if new_valid and not stale and (not old_valid or new_priority >= old_priority) then
      if not old_valid or new_value is distinct from old_value then
        meta := jsonb_set(meta,array[field],jsonb_build_object('value',new_value,'source',source_name,'updated_at',p_now));
        accepted := jsonb_set(accepted,array[group_name],'true'::jsonb);
        field_accepted := true;
      end if;
    elsif old_valid then
      result := jsonb_set(result,array[field],p_old->field);
    else
      result := jsonb_set(result,array[field],'null'::jsonb);
      meta := meta - field;
    end if;
    -- Keep ST and F/L together. A missing/stale ST cannot erase its F/L marker.
    if field in ('official_exhibition_st','exhibition_st') and old_valid and new_value is distinct from old_value and not field_accepted then
      source_field := case when field='official_exhibition_st' then 'official_exhibition_symbol' else 'exhibition_fl' end;
      result := jsonb_set(result,array[source_field],coalesce(p_old->source_field,'null'::jsonb));
    end if;
  end loop;
  -- A no-op poll or all-null payload must not relabel a retained value as freshly collected.
  foreach group_name in array array['official','general','api'] loop
    if not (accepted ? group_name) and p_old <> '{}'::jsonb then
      clock_field := case group_name when 'official' then 'official_exhibition_synced_at' when 'api' then 'api_preview_synced_at' else 'exhibition_synced_at' end;
      source_field := case group_name when 'official' then 'official_exhibition_source' when 'api' then 'api_preview_source' else 'exhibition_source' end;
      result := jsonb_set(result,array[clock_field],coalesce(p_old->clock_field,'null'::jsonb));
      result := jsonb_set(result,array[source_field],coalesce(p_old->source_field,'null'::jsonb));
    end if;
  end loop;
  return jsonb_set(result,'{exhibition_field_meta}',meta);
end;
$fn$;

create or replace function public.bs_guard_exhibition_write()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $fn$
begin
  new := jsonb_populate_record(new, public.bs_merge_exhibition_payload(
    case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end,
    to_jsonb(new), clock_timestamp()));
  return new;
end;
$fn$;

create or replace trigger bs_race_entries_exhibition_guard
before insert or update on public.bs_race_entries
for each row execute function public.bs_guard_exhibition_write();
comment on column public.bs_race_entries.exhibition_field_meta is 'Per-field accepted value provenance. Written only by the exhibition guard; empty incoming values cannot erase retained measurements.';
