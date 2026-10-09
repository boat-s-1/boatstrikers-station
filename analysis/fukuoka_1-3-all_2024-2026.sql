-- BoatStrikers 福岡 1-3-全 実績検証（読み取り専用）
-- 対象は2024-10-01〜2026-09-30のうちDBに存在する正常な3連単結果
-- 3連単は「132」「1-3-2」両形式を正規化する
WITH base AS (
 SELECT race_date,race_no,regexp_replace(coalesce(trifecta_result,''),'[^1-6]','','g') AS combo,trifecta_payout
 FROM public.bs_race_results
 WHERE course_code::text='22' AND race_date >= DATE '2024-10-01' AND race_date < DATE '2026-10-01'
), valid AS (
 SELECT * FROM base WHERE combo ~ '^[1-6]{3}$' AND trifecta_payout > 0
)
SELECT count(*) races,min(race_date) earliest,max(race_date) latest,
 count(*) FILTER(WHERE combo ~ '^13[2456]$') hits,
 round(100.0*count(*) FILTER(WHERE combo ~ '^13[2456]$')/nullif(count(*),0),2) hit_rate_pct,
 count(*)*400 investment_yen,
 coalesce(sum(trifecta_payout) FILTER(WHERE combo ~ '^13[2456]$'),0) return_yen,
 round(100.0*coalesce(sum(trifecta_payout) FILTER(WHERE combo ~ '^13[2456]$'),0)/nullif(count(*)*400,0),2) roi_pct
FROM valid;
-- 要別途検証: 返還・欠場・不成立、重複レース、欠損日。
