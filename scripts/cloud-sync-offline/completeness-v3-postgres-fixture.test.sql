-- Disposable PostgreSQL fixture only. Must run with ON_ERROR_STOP=1.
BEGIN;
DO $t$
DECLARE d date:=date '2026-11-13'; v jsonb; first_seen timestamptz; n integer;
BEGIN
 INSERT INTO bs_race_results(race_date,course_code,race_no,trifecta_payout,trifecta_result)
 VALUES (d,9,1,1200,'1-2-3');
 v:=bs_race_data_completeness_v3_candidate(d);
 IF (v->>'races')::integer<>1 OR (v->>'missing_base_event_count')::integer<>1 THEN
   RAISE EXCEPTION 'result-only summary failed: %',v;
 END IF;
 v:=bs_record_race_data_completeness_v3_candidate(d);
 IF (v->>'active_alerts_written')::integer<>1 THEN RAISE EXCEPTION 'first insert failed'; END IF;
 SELECT first_detected_at INTO first_seen FROM bs_race_data_quality_alerts
 WHERE race_date=d AND course_code=9 AND race_no=1;
 v:=bs_record_race_data_completeness_v3_candidate(d);
 SELECT count(*) INTO n FROM bs_race_data_quality_alerts WHERE race_date=d;
 IF n<>1 OR (SELECT first_detected_at FROM bs_race_data_quality_alerts WHERE race_date=d AND course_code=9 AND race_no=1)<>first_seen
 THEN RAISE EXCEPTION 'replay not idempotent'; END IF;
 -- Existing alert key disappears from both anchors: must abort and preserve alert.
 DELETE FROM bs_race_results WHERE race_date=d AND course_code=9 AND race_no=1;
 BEGIN
   PERFORM bs_record_race_data_completeness_v3_candidate(d);
   RAISE EXCEPTION 'empty-day guard did not abort';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='empty-day guard did not abort' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%no race keys%' THEN RAISE; END IF;
 END;
 IF (SELECT status FROM bs_race_data_quality_alerts WHERE race_date=d AND course_code=9 AND race_no=1)<>'active'
 THEN RAISE EXCEPTION 'empty-day guard mutated alert'; END IF;
 -- Another anchored race exists, but prior active key disappeared.
 INSERT INTO bs_race_events(race_date,course_code,race_no) VALUES(d,9,2);
 BEGIN
   PERFORM bs_record_race_data_completeness_v3_candidate(d);
   RAISE EXCEPTION 'disappearing-key guard did not abort';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='disappearing-key guard did not abort' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%race key disappeared%' THEN RAISE; END IF;
 END;
 -- Restore result key and add entry-only third key: must fail closed.
 INSERT INTO bs_race_results(race_date,course_code,race_no,trifecta_payout,trifecta_result)
 VALUES (d,9,1,1200,'1-2-3');
 INSERT INTO bs_race_entries(race_date,course_code,race_no,boat_no)
 VALUES (d,9,3,1);
 BEGIN
   PERFORM bs_record_race_data_completeness_v3_candidate(d);
   RAISE EXCEPTION 'entry-only guard did not abort';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='entry-only guard did not abort' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%uncovered entry-only race key%' THEN RAISE; END IF;
 END;
 DELETE FROM bs_race_entries WHERE race_date=d AND course_code=9 AND race_no=3;
 -- Partially repaired result-only key remains active.
 INSERT INTO bs_race_events(race_date,course_code,race_no) VALUES(d,9,1);
 v:=bs_record_race_data_completeness_v3_candidate(d);
 IF (SELECT status FROM bs_race_data_quality_alerts WHERE race_date=d AND course_code=9 AND race_no=1)<>'active'
 THEN RAISE EXCEPTION 'partial repair resolved alert'; END IF;
 -- Fully repair both event keys.
 INSERT INTO bs_race_results(race_date,course_code,race_no,trifecta_payout,trifecta_result)
 VALUES (d,9,2,1200,'1-2-3');
 INSERT INTO bs_race_entries(race_date,course_code,race_no,boat_no,exhibition_time,actual_st)
 SELECT d,9,race_no,boat_no,6.70,0.10 FROM generate_series(1,2) race_no CROSS JOIN generate_series(1,6) boat_no;
 v:=bs_record_race_data_completeness_v3_candidate(d);
 IF (v->>'is_complete')::boolean IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'full repair summary not complete: %',v;
 END IF;
 IF (SELECT status FROM bs_race_data_quality_alerts WHERE race_date=d AND course_code=9 AND race_no=1)<>'resolved'
 THEN RAISE EXCEPTION 'full repair did not resolve alert'; END IF;
 IF (SELECT count(*) FROM bs_live_source_sync_logs WHERE race_date=d)<>4
 THEN RAISE EXCEPTION 'unexpected successful recorder log count'; END IF;
 RAISE NOTICE 'V3 disposable PostgreSQL runtime fixture PASS';
END
$t$;
ROLLBACK;
