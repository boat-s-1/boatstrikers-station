create unique index if not exists uq_bsc_results_official_memo
  on public.bsc_results (memo)
  where memo like 'official_prediction:%';

create or replace function public.bsc_sync_official_results_to_legacy()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  update public.bsc_results b
  set
    race_date = p.race_date,
    place = case p.course_code
      when 1 then '桐生' when 2 then '戸田' when 3 then '江戸川' when 4 then '平和島'
      when 5 then '多摩川' when 6 then '浜名湖' when 7 then '蒲郡' when 8 then '常滑'
      when 9 then '津' when 10 then '三国' when 11 then 'びわこ' when 12 then '住之江'
      when 13 then '尼崎' when 14 then '鳴門' when 15 then '丸亀' when 16 then '児島'
      when 17 then '宮島' when 18 then '徳山' when 19 then '下関' when 20 then '若松'
      when 21 then '芦屋' when 22 then '福岡' when 23 then '唐津' when 24 then '大村'
      else p.course_code::text end,
    race_no = p.race_no,
    category = case p.character_code when 'ichika' then '一果' when 'hatsune' then '初音' when 'kiina' then 'キイナ' end,
    bet_text = (select string_agg(v, ', ' order by ord) from jsonb_array_elements_text(p.tickets) with ordinality as x(v, ord)),
    invest = p.investment,
    payout = r.payout,
    hit = r.is_hit
  from public.bsc_official_predictions p
  join public.bsc_official_results r on r.prediction_id = p.id
  where b.memo = 'official_prediction:' || p.id::text;

  insert into public.bsc_results (
    id, race_date, place, race_no, category, bet_text,
    invest, payout, hit, memo, created_at
  )
  select
    gen_random_uuid(),
    p.race_date,
    case p.course_code
      when 1 then '桐生' when 2 then '戸田' when 3 then '江戸川' when 4 then '平和島'
      when 5 then '多摩川' when 6 then '浜名湖' when 7 then '蒲郡' when 8 then '常滑'
      when 9 then '津' when 10 then '三国' when 11 then 'びわこ' when 12 then '住之江'
      when 13 then '尼崎' when 14 then '鳴門' when 15 then '丸亀' when 16 then '児島'
      when 17 then '宮島' when 18 then '徳山' when 19 then '下関' when 20 then '若松'
      when 21 then '芦屋' when 22 then '福岡' when 23 then '唐津' when 24 then '大村'
      else p.course_code::text end,
    p.race_no,
    case p.character_code when 'ichika' then '一果' when 'hatsune' then '初音' when 'kiina' then 'キイナ' end,
    (select string_agg(v, ', ' order by ord) from jsonb_array_elements_text(p.tickets) with ordinality as x(v, ord)),
    p.investment,
    r.payout,
    r.is_hit,
    'official_prediction:' || p.id::text,
    now()
  from public.bsc_official_predictions p
  join public.bsc_official_results r on r.prediction_id = p.id
  where not exists (
    select 1 from public.bsc_results b
    where b.memo = 'official_prediction:' || p.id::text
  )
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.bsc_refresh_official_performance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  jst_today date := (now() at time zone 'Asia/Tokyo')::date;
  captured_today_previous integer := 0;
  captured_today_live integer := 0;
  captured_yesterday_previous integer := 0;
  captured_yesterday_live integer := 0;
  settled_today integer := 0;
  settled_yesterday integer := 0;
  legacy_inserted integer := 0;
begin
  captured_today_previous := public.bsc_capture_official_rankings(jst_today, 'previous_day');
  captured_today_live := public.bsc_capture_official_rankings(jst_today, 'after_exhibition');
  captured_yesterday_previous := public.bsc_capture_official_rankings(jst_today - 1, 'previous_day');
  captured_yesterday_live := public.bsc_capture_official_rankings(jst_today - 1, 'after_exhibition');

  settled_today := public.bsc_settle_official_predictions(jst_today);
  settled_yesterday := public.bsc_settle_official_predictions(jst_today - 1);
  legacy_inserted := public.bsc_sync_official_results_to_legacy();

  return jsonb_build_object(
    'jst_today', jst_today,
    'captured_today_previous', captured_today_previous,
    'captured_today_after_exhibition', captured_today_live,
    'captured_yesterday_previous', captured_yesterday_previous,
    'captured_yesterday_after_exhibition', captured_yesterday_live,
    'settled_today', settled_today,
    'settled_yesterday', settled_yesterday,
    'legacy_inserted', legacy_inserted
  );
end;
$$;

revoke all on function public.bsc_sync_official_results_to_legacy() from public;
revoke all on function public.bsc_refresh_official_performance() from public;
grant execute on function public.bsc_sync_official_results_to_legacy() to service_role;
grant execute on function public.bsc_refresh_official_performance() to service_role;

select public.bsc_sync_official_results_to_legacy();

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'bsc-official-performance-refresh' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'bsc-official-performance-refresh',
    '15 0-14,22-23 * * *',
    'select public.bsc_refresh_official_performance();'
  );
end $$;