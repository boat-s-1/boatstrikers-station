begin;
create temp table bsc_audit_official (like public.bsc_official_predictions including all) on commit drop;
create temp table bsc_audit_predictions (like public.bs_ai_predictions including all) on commit drop;
create or replace function pg_temp.bsc_audit_freeze()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  frozen_tickets jsonb := '[]'::jsonb;
  ticket_scores jsonb := '[]'::jsonb;
  ticket_count integer := 0;
begin
  if not coalesce(new.published, false) then
    return new;
  end if;

  if jsonb_typeof(coalesce(new.bet_json, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(new.bet_json, '[]'::jsonb)) = 0 then
    return new;
  end if;

  -- Once a published row with bets already existed, later model refreshes must not
  -- change the official ticket snapshot.
  if tg_op = 'UPDATE'
     and coalesce(old.published, false)
     and jsonb_typeof(coalesce(old.bet_json, '[]'::jsonb)) = 'array'
     and jsonb_array_length(coalesce(old.bet_json, '[]'::jsonb)) > 0 then
    return new;
  end if;

  with raw as (
    select
      ord,
      case
        when jsonb_typeof(item) = 'string' then trim(both '"' from item::text)
        when jsonb_typeof(item) = 'object' then coalesce(item->>'bet', item->>'combination', item->>'ticket')
        else null
      end as ticket
    from jsonb_array_elements(new.bet_json) with ordinality as x(item, ord)
  ),
  valid as (
    select distinct on (ticket) ord, ticket
    from raw
    where ticket ~ '^[1-6]-[1-6]-[1-6]$'
      and split_part(ticket, '-', 1) <> split_part(ticket, '-', 2)
      and split_part(ticket, '-', 1) <> split_part(ticket, '-', 3)
      and split_part(ticket, '-', 2) <> split_part(ticket, '-', 3)
    order by ticket, ord
  ),
  ordered as (
    select ord, ticket
    from valid
    order by ord
  )
  select
    coalesce(jsonb_agg(to_jsonb(ticket) order by ord), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('ticket', ticket, 'score', 100000 - ord) order by ord), '[]'::jsonb),
    count(*)::integer
  into frozen_tickets, ticket_scores, ticket_count
  from ordered;

  if ticket_count = 0 then
    return new;
  end if;

  insert into pg_temp.bsc_audit_official (
    race_date,
    course_code,
    race_no,
    character_code,
    timing,
    ranking_type,
    rank_no,
    source_table,
    source_id,
    prediction_label,
    tickets,
    unit_stake,
    snapshot,
    published_at
  ) values (
    new.race_date,
    new.course_code,
    new.race_no,
    new.character_code,
    new.timing,
    null,
    null,
    'bs_ai_predictions',
    new.id::text,
    case new.character_code
      when 'ichika' then '一果 公開買い目'
      when 'hatsune' then '初音 公開買い目'
      when 'kiina' then 'キイナ 公開買い目'
      else '公開買い目'
    end,
    frozen_tickets,
    100,
    jsonb_build_object(
      'source', 'published_page_prediction',
      'ai_prediction_id', new.id,
      'displayed_bet_json', new.bet_json,
      'ticket_scores', ticket_scores,
      'bet_count', ticket_count,
      'bet_count_rule', new.detail_json->>'bet_count_rule',
      'frozen_model_version', new.model_version
    ),
    clock_timestamp()
  )
  on conflict (character_code, timing, source_table, source_id) do nothing;

  return new;
end;
$$;


create trigger audit_freeze after insert or update on bsc_audit_predictions for each row execute function pg_temp.bsc_audit_freeze();
insert into bsc_audit_predictions(race_date,course_code,race_no,character_code,timing,published,bet_json)
values ('2099-01-01',1,1,'ichika','previous_day',true,'["1-2-3","1-3-2","1-2-3","1-1-2"]');
do $$ begin
 if (select count(*) from bsc_audit_official where investment=200 and jsonb_array_length(tickets)=2) <> 1 then raise exception 'Generated investment regression'; end if;
end $$;
update bsc_audit_predictions set bet_json='["6-5-4"]';
do $$ begin
 if (select count(*) from bsc_audit_official) <> 1 or (select investment from bsc_audit_official) <> 200 then raise exception 'Frozen snapshot regression'; end if;
end $$;
rollback;
select 'PASS: generated investment and frozen snapshot' as result;
