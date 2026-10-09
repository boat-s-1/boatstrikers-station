-- BoatStrikers / 福岡 1-3-全 2年間の検証（読み取り専用）
-- Supabase SQL Editor で実行。既存データは変更しません。
-- 2024-10-01 から 2026-09-30 の範囲。
-- 注意: status, 返還, 不成立の取り扱いはデータ確認後に確定すること。
WITH base AS (
 SELECT race_date, race_no, trifecta, trifecta_payout,
        CASE WHEN regexp_replace(coalesce(trifecta,''),'[^0-9]','','g') IN ('132','134','135','136') THEN true ELSE false END AS hit
 FROM public.bs_ai_race_history
 WHERE course_code::text IN ('22','福岡')
   AND race_date >= DATE '2024-10-01'
   AND race_date < DATE '2026-10-01'
), quality AS (
 SELECT count(*) AS stored_rows,
        min(race_date) AS earliest, max(race_date) AS latest,
        count(*) FILTER (WHERE trifecta IS NOT NULL AND trifecta_payout IS NOT NULL) AS settled_rows
 FROM base
), valid AS (
 SELECT * FROM base WHERE trifecta IS NOT NULL AND trifecta_payout IS NOT NULL
)
SELECT q.stored_rows, q.earliest, q.latest, q.settled_rows,
       count(v.*) AS analyzed_races,
       count(*) FILTER (WHERE v.hit) AS hits,
       round(100.0*count(*) FILTER (WHERE v.hit)/nullif(count(v.*),0),2) AS hit_rate_pct,
       count(v.*)*400 AS stake_yen,
       coalesce(sum(CASE WHEN v.hit THEN v.trifecta_payout ELSE 0 END),0) AS return_yen,
       round(100.0*coalesce(sum(CASE WHEN v.hit THEN v.trifecta_payout ELSE 0 END),0)/nullif(count(v.*)*400,0),2) AS roi_pct
FROM quality q LEFT JOIN valid v ON true
GROUP BY q.stored_rows,q.earliest,q.latest,q.settled_rows;
