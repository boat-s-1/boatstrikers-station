#!/usr/bin/env bash
# Disposable PostgreSQL service only. No production connection.
set -euo pipefail
export PGOPTIONS="-c statement_timeout=30000 -c lock_timeout=15000"
date_key=2026-11-15
# A dedicated date, 24 incomplete races, so concurrent recorders contend on
# identical UPSERT keys. Each transaction is independently committed.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO public.bs_race_results(race_date,course_code,race_no,trifecta_payout,trifecta_result)
SELECT DATE '2026-11-15',c::smallint,r::smallint,1200,'1-2-3'
FROM generate_series(1,2) c CROSS JOIN generate_series(1,12) r;
SQL
pids=()
for i in 1 2 3 4; do
  (psql -X -v ON_ERROR_STOP=1 -Atc "SELECT (public.bs_record_race_data_completeness_v3_candidate(DATE '$date_key')->>'issue_count')::int" | grep -qx 24) &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $t$
DECLARE n int; logs int;
BEGIN
 SELECT count(*) INTO n FROM public.bs_race_data_quality_alerts
 WHERE race_date=DATE '2026-11-15' AND status='active';
 IF n<>24 THEN RAISE EXCEPTION 'concurrency alert count %, expected 24',n; END IF;
 SELECT count(*) INTO logs FROM public.bs_live_source_sync_logs
 WHERE race_date=DATE '2026-11-15' AND sync_kind='daily_completeness_v3_candidate';
 IF logs<>4 THEN RAISE EXCEPTION 'concurrency log count %, expected 4',logs; END IF;
 IF EXISTS (SELECT 1 FROM public.bs_race_data_quality_alerts
 WHERE race_date=DATE '2026-11-15' GROUP BY course_code,race_no HAVING count(*)>1)
 THEN RAISE EXCEPTION 'duplicate alert keys'; END IF;
 RAISE NOTICE 'V3 4-session concurrent recorder fixture PASS';
END
$t$;
SQL
