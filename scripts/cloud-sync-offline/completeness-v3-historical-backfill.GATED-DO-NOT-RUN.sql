-- PRODUCTION WRITE: REVIEW ONLY, DO NOT RUN WITHOUT EXPLICIT APPROVAL.
-- This does NOT repair missing source data; it only creates V3 quality alerts/logs.
-- Prerequisites: V3 candidates deployed/verified; V2 recorder cut over and
-- guaranteed not running concurrently; backup/rollback and notification plan.
-- One date per transaction avoids unexpectedly broad changes.
-- Confirm date/expected result-only count from fresh READ-ONLY preflight.
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='3s';
DO $backfill$
DECLARE
 d date;
 expected integer;
 observed integer;
 summary jsonb;
BEGIN
 FOR d,expected IN
   SELECT x.race_date,x.expected
   FROM (VALUES
      (DATE '2026-11-13',156),
      (DATE '2026-11-14',168),
      (DATE '2026-11-15',156),
      (DATE '2026-11-16',120)
   ) AS x(race_date,expected)
 LOOP
   SELECT count(*) INTO observed
   FROM public.bs_race_results r
   WHERE r.race_date=d
     AND NOT EXISTS (
       SELECT 1 FROM public.bs_race_events e
       WHERE e.race_date=r.race_date AND e.course_code=r.course_code
         AND e.race_no=r.race_no
     );
   IF observed<>expected THEN
     RAISE EXCEPTION 'Source drift on %, expected %, observed %; abort all',d,expected,observed;
   END IF;
 END LOOP;
 -- Gate all dates first, then record in one atomic transaction.
 FOR d,expected IN
   SELECT x.race_date,x.expected FROM (VALUES
      (DATE '2026-11-13',156),(DATE '2026-11-14',168),
      (DATE '2026-11-15',156),(DATE '2026-11-16',120)
   ) AS x(race_date,expected)
 LOOP
   summary := public.bs_record_race_data_completeness_v3_candidate(d);
   IF (summary->>'missing_base_event_count')::integer<>expected THEN
     RAISE EXCEPTION 'Recorder mismatch on %: expected %, got %',
       d,expected,summary->>'missing_base_event_count';
   END IF;
 END LOOP;
END
$backfill$;
COMMIT;
-- WARNING: recorder emits pg_notify on COMMIT for partial dates. Consumers may
-- receive four notifications. Confirm downstream delivery and rate limits first.
-- If any test fails, transaction rolls back, but identity sequences can advance.
