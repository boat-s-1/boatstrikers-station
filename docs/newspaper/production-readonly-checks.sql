-- 前日版新聞 自動下書き：本番導入前の実データ確認（読み取り専用）
-- まだ実行しないこと。実行は承認後、Supabase SQL Editor 等で行う。
--
-- 安全のため、全体を読み取り専用トランザクションで囲み、最後に ROLLBACK する。
-- 書き込み（INSERT/UPDATE/DELETE/DDL）を含む文は入れていない。読み取り専用トランザクション内では
-- 誤って書き込みを含めても実行時にエラーになる。
-- 対象期間は直近14日（必要に応じて :days を変更）。時刻はすべて JST で表示する。

begin transaction read only;
set local statement_timeout = '60s';
set local timezone = 'Asia/Tokyo';

-- ---------------------------------------------------------------------------
-- 0. 列の確認（以降のクエリが前提とする列があるか）
--    created_at が無いテーブルは、1・7 の created_at 版をスキップする。
-- ---------------------------------------------------------------------------
select table_name, string_agg(column_name, ', ' order by ordinal_position) as columns
from information_schema.columns
where table_schema = 'public'
  and table_name in ('ai_v2_daily_rankings', 'bs_race_entries', 'bs_race_events', 'bs_race_results',
                     'bsc_official_predictions', 'bs_newspaper_publications', 'bs_news_sync_logs')
group by table_name
order by table_name;

-- ---------------------------------------------------------------------------
-- 1. ai_v2_daily_rankings（展示前＝previous_day）の生成時刻
--    updated_at は「最後に更新された時刻」。SNS選択等で後から更新されると遅く見える点に注意。
--    hours_from_race_day_start：レース当日 00:00 JST からの経過時間（負なら前日中に作成）。
-- ---------------------------------------------------------------------------
select ranking_date,
       character_code,
       ranking_type,
       count(*)                                    as rows,
       min(updated_at)                             as first_updated_jst,
       max(updated_at)                             as last_updated_jst,
       round(extract(epoch from (min(updated_at) - ranking_date::timestamp)) / 3600.0, 2) as hours_from_race_day_start
from ai_v2_daily_rankings
where data_timing = 'previous_day'
  and ranking_date >= current_date - 14
group by ranking_date, character_code, ranking_type
order by ranking_date desc, character_code, ranking_type;

-- 1b. created_at がある場合のみ（0 で確認してから実行）
-- select ranking_date, character_code, min(created_at) as first_created_jst, max(created_at) as last_created_jst
-- from ai_v2_daily_rankings
-- where data_timing = 'previous_day' and ranking_date >= current_date - 14
-- group by ranking_date, character_code order by ranking_date desc, character_code;

-- ---------------------------------------------------------------------------
-- 2. 3キャラの候補数（自動下書きが参照するランキング種類のみ）と、確率が使える候補数
-- ---------------------------------------------------------------------------
select ranking_date,
       character_code,
       count(*)                                                                   as candidates,
       count(*) filter (where probability is not null and probability between 0 and 1) as valid_probability,
       count(*) filter (where course_code between 1 and 24 and race_no between 1 and 12) as valid_race
from ai_v2_daily_rankings
where data_timing = 'previous_day'
  and ranking_date >= current_date - 14
  and ranking_type in ('ichika_escape_best10', 'hatsune_dominant_best3', 'hatsune_risky_best3', 'kiina_boat5_best5')
group by ranking_date, character_code
order by ranking_date desc, character_code;

-- ---------------------------------------------------------------------------
-- 3. bs_race_entries の6艇充足率（全レース／ランキング候補レース）
--    「充足」＝1〜6号艇がちょうど1行ずつそろっていること。
-- ---------------------------------------------------------------------------
with races as (
  select e.race_date, e.course_code, e.race_no
  from bs_race_events e
  where e.race_date >= current_date - 14
),
boats as (
  select race_date, course_code, race_no,
         count(*) as rows,
         count(distinct boat_no) filter (where boat_no between 1 and 6) as distinct_boats
  from bs_race_entries
  where race_date >= current_date - 14
  group by race_date, course_code, race_no
),
ranked as (
  select distinct ranking_date as race_date, course_code, race_no
  from ai_v2_daily_rankings
  where data_timing = 'previous_day' and ranking_date >= current_date - 14
    and ranking_type in ('ichika_escape_best10', 'hatsune_dominant_best3', 'hatsune_risky_best3', 'kiina_boat5_best5')
)
select r.race_date,
       count(*)                                                                         as races,
       count(*) filter (where b.rows = 6 and b.distinct_boats = 6)                       as complete_6,
       round(100.0 * count(*) filter (where b.rows = 6 and b.distinct_boats = 6) / nullif(count(*), 0), 1) as complete_pct,
       count(*) filter (where k.race_date is not null)                                   as ranked_races,
       count(*) filter (where k.race_date is not null and b.rows = 6 and b.distinct_boats = 6) as ranked_complete_6
from races r
left join boats b using (race_date, course_code, race_no)
left join ranked k using (race_date, course_code, race_no)
group by r.race_date
order by r.race_date desc;

-- ---------------------------------------------------------------------------
-- 4. closing_time の欠損率と形式（自動下書きは締切時刻が読めないレースを作らない）
--    読める形式：'HH:MM'、'HH:MM:SS'、'HHMM'（3〜4桁）、ISO日時（'T' を含む）。
-- ---------------------------------------------------------------------------
select e.race_date,
       count(*)                                                                as races,
       count(*) filter (where e.closing_time is null or trim(e.closing_time::text) = '') as missing,
       round(100.0 * count(*) filter (where e.closing_time is null or trim(e.closing_time::text) = '') / nullif(count(*), 0), 1) as missing_pct,
       count(*) filter (where e.closing_time is not null and trim(e.closing_time::text) <> ''
                          and trim(e.closing_time::text) !~ '^\d{1,2}:\d{2}(:\d{2})?$'
                          and trim(e.closing_time::text) !~ '^\d{3,4}$'
                          and position('T' in e.closing_time::text) = 0)            as unreadable_format,
       min(e.closing_time::text)                                               as sample_min,
       max(e.closing_time::text)                                               as sample_max
from bs_race_events e
where e.race_date >= current_date - 14
group by e.race_date
order by e.race_date desc;

-- ---------------------------------------------------------------------------
-- 5. 凍結済み公式買い目（bsc_official_predictions）の有無：ランキング候補ごと
-- ---------------------------------------------------------------------------
select r.ranking_date,
       r.character_code,
       count(*)                                         as candidates,
       count(p.race_date)                               as with_frozen_tickets,
       count(p.race_date) filter (where jsonb_typeof(p.tickets) = 'array' and jsonb_array_length(p.tickets) > 0) as with_nonempty_tickets
from ai_v2_daily_rankings r
left join lateral (
  select o.race_date, o.tickets
  from bsc_official_predictions o
  where o.race_date = r.ranking_date and o.course_code = r.course_code and o.race_no = r.race_no
    and o.character_code = r.character_code and o.timing = 'previous_day'
    and o.source_table = 'ai_v2_daily_rankings' and o.ranking_type = r.ranking_type and o.rank_no = r.rank_no
  order by o.published_at desc nulls last
  limit 1
) p on true
where r.data_timing = 'previous_day' and r.ranking_date >= current_date - 14
  and r.ranking_type in ('ichika_escape_best10', 'hatsune_dominant_best3', 'hatsune_risky_best3', 'kiina_boat5_best5')
group by r.ranking_date, r.character_code
order by r.ranking_date desc, r.character_code;

-- ---------------------------------------------------------------------------
-- 6. 既存新聞（bs_newspaper_publications）との重複：同じ日・場・R・キャラの前日版があるか
--    場名は 1=桐生 … 24=大村（アプリの STADIUMS と同じ並び）。
-- ---------------------------------------------------------------------------
with stadiums(code, name) as (
  select * from unnest(
    array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24],
    array['桐生','戸田','江戸川','平和島','多摩川','浜名湖','蒲郡','常滑','津','三国','びわこ','住之江','尼崎','鳴門','丸亀','児島','宮島','徳山','下関','若松','芦屋','福岡','唐津','大村'])
)
select r.ranking_date,
       r.character_code,
       count(*)                                                as candidates,
       count(n.id)                                             as already_has_newspaper,
       count(n.id) filter (where n.status = 'published')       as published,
       count(n.id) filter (where n.status = 'draft')           as draft,
       count(n.id) filter (where n.source_payload->>'generator' = 'auto-previous-day-v1') as auto_generated
from ai_v2_daily_rankings r
join stadiums s on s.code = r.course_code
left join bs_newspaper_publications n
  on n.race_date = r.ranking_date and n.course_name = s.name and n.race_no = r.race_no
 and n.character_key = r.character_code and n.edition = 'previous_day'
where r.data_timing = 'previous_day' and r.ranking_date >= current_date - 14
  and r.ranking_type in ('ichika_escape_best10', 'hatsune_dominant_best3', 'hatsune_risky_best3', 'kiina_boat5_best5')
group by r.ranking_date, r.character_code
order by r.ranking_date desc, r.character_code;

-- 6b. 新聞テーブルに、同じ日・キャラ・版で複数の新聞がある日（自動下書きの1日1件制約を作る前の確認）
select race_date, character_key, edition, count(*) as rows, array_agg(status order by status) as statuses
from bs_newspaper_publications
where race_date >= current_date - 30
group by race_date, character_key, edition
having count(*) > 1
order by race_date desc, character_key;

-- ---------------------------------------------------------------------------
-- 7. 出走表の初回保存時刻（created_at がある場合のみ。0 で確認してから実行）
--    前日版データがレース当日の何時に揃うかの目安。
-- ---------------------------------------------------------------------------
-- select race_date, min(created_at) as first_entry_created_jst, max(created_at) as last_entry_created_jst, count(*) as rows
-- from bs_race_entries
-- where race_date >= current_date - 14
-- group by race_date order by race_date desc;

rollback;
