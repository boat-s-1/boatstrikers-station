# Remaining alert-trigger function

Read-only production pg_catalog extract on 2026-11-17. Review reference only. Runs with SECURITY DEFINER and writes theory recommendations; isolate and check privileges before executing.

```sql
CREATE OR REPLACE FUNCTION public.bs_capture_theory_recommendation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  arr text[] := array[]::text[];
  ticket_json jsonb := '[]'::jsonb;
  label_text text;
  rec_type text := 'tickets';
  theory text;
  character text;
  source text := tg_table_name;
  rec_id bigint;
  second_boat integer;
  r234 text;
  r235 text;
  r345 text;
begin
  if tg_table_name = 'bs_ichika_escape_surge_alerts' then
    theory := 'ichika_escape_surge';
    character := 'ichika';
    second_boat := new.recommended_second_boat;
    if second_boat is null or second_boat = 1 then
      rec_type := 'signal_only';
      label_text := '2着候補未設定';
    else
      label_text := format('1-%s-全', second_boat);
      select array_agg(format('1-%s-%s', second_boat, n) order by n)
        into arr
      from generate_series(2,6) n
      where n <> second_boat;
    end if;
  elsif tg_table_name = 'bs_hatsune_box_alerts' then
    theory := 'hatsune_box';
    character := 'hatsune';
    r234 := new.box_234_rating;
    r235 := new.box_235_rating;
    r345 := new.box_345_rating;
    if r234 in ('◎','○') then arr := arr || array['2-3-4','2-4-3','3-2-4','3-4-2','4-2-3','4-3-2']; end if;
    if r235 in ('◎','○') then arr := arr || array['2-3-5','2-5-3','3-2-5','3-5-2','5-2-3','5-3-2']; end if;
    if r345 in ('◎','○') then arr := arr || array['3-4-5','3-5-4','4-3-5','4-5-3','5-3-4','5-4-3']; end if;
    label_text := concat_ws(' + ',
      case when r234 in ('◎','○') then '234BOX' end,
      case when r235 in ('◎','○') then '235BOX' end,
      case when r345 in ('◎','○') then '345BOX' end
    );
    if coalesce(array_length(arr,1),0) = 0 then
      rec_type := 'signal_only';
      label_text := '推奨BOX未設定';
    end if;
  elsif tg_table_name = 'bs_exhibition_alerts' then
    theory := 'kiina_kado';
    character := 'kiina';
    rec_type := 'signal_only';
    label_text := format('展示%s位 × 直線%s位（買い目未設定）', coalesce(new.exhibition_rank::text,'-'), coalesce(new.straight_rank::text,'-'));
  else
    return new;
  end if;

  if coalesce(array_length(arr,1),0) > 0 then
    select coalesce(jsonb_agg(ticket order by ticket), '[]'::jsonb)
      into ticket_json
    from (select distinct unnest(arr) as ticket) q;
  end if;

  insert into public.bs_theory_recommendations (
    theory_key, character_code, source_table, source_alert_id,
    race_date, course_code, course_name, race_no,
    recommendation_type, recommendation_label, tickets,
    unit_stake, ticket_count, investment, recommended_at, metadata
  ) values (
    theory, character, source, new.id,
    new.race_date, new.course_code, new.course_name, new.race_no,
    rec_type, label_text, ticket_json,
    100, jsonb_array_length(ticket_json), jsonb_array_length(ticket_json) * 100,
    coalesce(new.detected_at, now()),
    jsonb_build_object('snapshot_version',1,'source','theory_alert')
  )
  on conflict (source_table, source_alert_id) do update
  set recommendation_type = excluded.recommendation_type,
      recommendation_label = excluded.recommendation_label,
      tickets = excluded.tickets,
      ticket_count = excluded.ticket_count,
      investment = excluded.investment,
      metadata = excluded.metadata,
      updated_at = now()
  returning id into rec_id;

  perform public.bs_settle_theory_recommendation(rec_id);
  return new;
end;
$function$

```
