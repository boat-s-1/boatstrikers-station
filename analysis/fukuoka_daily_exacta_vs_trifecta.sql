-- 福岡12R企画：2連単1-3 vs 3連単1-3-全 / 日別検証
-- READ ONLY. 返還/欠場/不成立は別途検証。全12R成立の日だけ日別評価。
WITH source AS (
 SELECT r.race_date,r.race_no,
 regexp_replace(coalesce(r.trifecta_result,r.winning_trifecta,''),'[^1-6]','','g') AS tri,
 r.trifecta_payout,
 regexp_replace(coalesce(e.exacta,''),'[^1-6]','','g') AS ex,
 e.exacta_payout
 FROM public.bs_race_results r
 LEFT JOIN public.bs_race_events e
 ON r.race_date=e.race_date AND r.course_code=e.course_code AND r.race_no=e.race_no
 WHERE r.course_code=22 AND r.race_date >= DATE '2024-10-01' AND r.race_date < DATE '2026-10-01'
), valid AS (
 SELECT *, CASE WHEN tri ~ '^13[2456]$' THEN trifecta_payout ELSE 0 END AS tri_return,
 CASE WHEN ex='13' THEN exacta_payout ELSE 0 END AS ex_return
 FROM source
 WHERE tri ~ '^[1-6]{3}$' AND trifecta_payout>0
), per_day AS (
 SELECT race_date,count(*) races,
 count(*) FILTER(WHERE ex ~ '^[1-6]{2}$' AND exacta_payout>0) ex_available,
 sum(tri_return) tri_return,
 sum(ex_return) FILTER(WHERE ex ~ '^[1-6]{2}$' AND exacta_payout>0) ex_return
 FROM valid GROUP BY race_date
)
SELECT count(*) FILTER(WHERE races=12) complete_days,
 count(*) FILTER(WHERE races=12 AND ex_available=12) comparable_days,
 count(*) FILTER(WHERE races=12 AND tri_return>4800) tri_profitable_days,
 round(avg(tri_return) FILTER(WHERE races=12),2) tri_average_daily_return,
 max(tri_return) FILTER(WHERE races=12) tri_max_daily_return,
 min(tri_return) FILTER(WHERE races=12) tri_min_daily_return,
 count(*) FILTER(WHERE races=12 AND ex_available=12 AND ex_return>1200) ex_profitable_days,
 round(avg(ex_return) FILTER(WHERE races=12 AND ex_available=12),2) ex_average_daily_return
FROM per_day;
-- 注意: これは本命単体の比較。毎日6,000円の混合買いには
-- 1-3の本命100円+穴400円、および1-3-全400円+穴100円を
-- 同一レースの穴買い目に結合する必要がある。
