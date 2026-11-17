-- Disposable PostgreSQL only. 240 races across 20 courses x 12R; 1,440 boat rows.
-- Does not model real OpenAPI ingestion or production triggers.
BEGIN;
SET LOCAL statement_timeout = '90s';
DO $test$
DECLARE
 d date := DATE '2026-11-14';
 v jsonb;
 n int;
 original_seen timestamptz;
BEGIN
 -- 120 complete races, 120 result-only races.
 INSERT INTO bs_race_events(race_date,course_code,race_no,course_name)
 SELECT d,course::smallint,race::smallint,'Fixture'
 FROM generate_series(1,10) course CROSS JOIN generate_series(1,12) race;
 INSERT INTO bs_race_results(race_date,course_code,race_no,trifecta_payout,trifecta_result)
 SELECT d,course::smallint,race::smallint,1200,'1-2-3'
 FROM generate_series(1,20) course CROSS JOIN generate_series(1,12) race;
 INSERT INTO bs_race_entries(race_date,course_code,race_no,boat_no,exhibition_time,actual_st)
 SELECT d,course::smallint,race::smallint,boat::smallint,6.7,0.10
 FROM generate_series(1,20) course CROSS JOIN generate_series(1,12) race
 CROSS JOIN generate_series(1,6) boat;
 v:=bs_race_data_completeness_v3_candidate(d);
 IF (v->>'races')::int<>240 OR (v->>'issue_count')::int<>120
 OR (v->>'missing_base_event_count')::int<>120 THEN
   RAISE EXCEPTION 'load summary mismatch %',v;
 END IF;
 v:=bs_record_race_data_completeness_v3_candidate(d);
 IF (v->>'active_alerts_written')::int<>120 THEN
   RAISE EXCEPTION 'load alert count mismatch %',v->>'active_alerts_written';
 END IF;
 SELECT first_detected_at INTO original_seen FROM bs_race_data_quality_alerts
 WHERE race_date=d AND course_code=11 AND race_no=1;
 PERFORM bs_record_race_data_completeness_v3_candidate(d);
 SELECT count(*) INTO n FROM bs_race_data_quality_alerts WHERE race_date=d;
 IF n<>120 OR (SELECT first_detected_at FROM bs_race_data_quality_alerts
 WHERE race_date=d AND course_code=11 AND race_no=1) IS DISTINCT FROM original_seen THEN
   RAISE EXCEPTION 'load replay duplicated alerts or changed first_seen';
 END IF;
 -- Complete all 120 result-only races and verify all alerts resolve.
 INSERT INTO bs_race_events(race_date,course_code,race_no,course_name)
 SELECT d,course::smallint,race::smallint,'Fixture'
 FROM generate_series(11,20) course CROSS JOIN generate_series(1,12) race;
 v:=bs_record_race_data_completeness_v3_candidate(d);
 IF (v->>'is_complete')::boolean IS DISTINCT FROM true
 OR (v->>'alerts_resolved')::int<>120 THEN
   RAISE EXCEPTION 'load repair mismatch %',v;
 END IF;
 IF (SELECT count(*) FROM bs_race_data_quality_alerts WHERE race_date=d AND status='active')<>0
 OR (SELECT count(*) FROM bs_race_data_quality_alerts WHERE race_date=d AND status='resolved')<>120 THEN
   RAISE EXCEPTION 'load resolution count mismatch';
 END IF;
 RAISE NOTICE 'V3 240-race/1440-entry load fixture PASS';
END
$test$;
ROLLBACK;
