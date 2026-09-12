create or replace function public.bsc_freeze_published_ai_bets()
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

  insert into public.bsc_official_predictions (
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
    investment,
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
    ticket_count * 100,
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

drop trigger if exists trg_bsc_freeze_published_ai_bets on public.bs_ai_predictions;

create trigger trg_bsc_freeze_published_ai_bets
after insert or update on public.bs_ai_predictions
for each row
execute function public.bsc_freeze_published_ai_bets();

-- If both an old reconstructed ranking ticket set and an exact page-published
-- snapshot exist for the same race/character/timing, the exact snapshot wins.
create or replace view public.v_bsc_official_performance as
select
  p.id as prediction_id,
  p.race_date,
  p.course_code,
  p.race_no,
  p.character_code,
  p.timing,
  p.ranking_type,
  p.rank_no,
  p.prediction_label,
  p.tickets,
  p.unit_stake,
  p.investment,
  p.published_at,
  r.result_combination,
  r.trifecta_payout,
  r.is_hit,
  r.hit_ticket,
  r.payout,
  r.profit,
  r.settled_at
from public.bsc_official_predictions p
join public.bsc_official_results r on r.prediction_id = p.id
where p.source_table = 'bs_ai_predictions'
   or not exists (
     select 1
     from public.bsc_official_predictions exact
     where exact.source_table = 'bs_ai_predictions'
       and exact.race_date = p.race_date
       and exact.course_code = p.course_code
       and exact.race_no = p.race_no
       and exact.character_code = p.character_code
       and exact.timing = p.timing
   );
