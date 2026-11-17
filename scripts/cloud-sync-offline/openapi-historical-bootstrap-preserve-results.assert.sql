-- Disposable PostgreSQL CI only. Test historical backfill of missing program
-- without touching pre-existing results/payouts. No production write.
DO $test$
DECLARE
 d date := DATE '2026-11-13';
 ev jsonb;
 en jsonb;
 before_result jsonb;
 after_result jsonb;
 response jsonb;
BEGIN
 INSERT INTO public.bs_race_results
  (race_date,course_code,race_no,trifecta_result,trifecta_payout,result_status,synced_at)
 VALUES(d,9,11,'1-3-5',12540,'settled',now());
 SELECT to_jsonb(r) INTO before_result FROM public.bs_race_results r
 WHERE (race_date,course_code,race_no)=(d,9,11);
 ev:=jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,
   'race_no',11,'course_name','historical fixture'));
 SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',9,
   'race_no',11,'boat_no',b,'racer_registration_no',lpad((2000+b)::text,5,'0')))
 INTO en FROM generate_series(1,6) b;
 response:=public.bs_apply_openapi_bootstrap(ev,en,now());
 IF (response->>'event_inserted')::int<>1 OR (response->>'entry_inserted')::int<>6 THEN
   RAISE EXCEPTION 'historical fixture first backfill unexpected: %',response;
 END IF;
 IF (SELECT count(*) FROM public.bs_race_entries
   WHERE (race_date,course_code,race_no)=(d,9,11))<>6 THEN
   RAISE EXCEPTION 'historical fixture did not create all six boats';
 END IF;
 SELECT to_jsonb(r) INTO after_result FROM public.bs_race_results r
 WHERE (race_date,course_code,race_no)=(d,9,11);
 IF before_result IS DISTINCT FROM after_result THEN
   RAISE EXCEPTION 'historical fixture changed existing result/payout';
 END IF;
 response:=public.bs_apply_openapi_bootstrap(ev,en,now());
 IF (response->>'event_inserted')::int<>0 OR (response->>'entry_inserted')::int<>0 THEN
   RAISE EXCEPTION 'historical fixture replay was not idempotent: %',response;
 END IF;
 SELECT to_jsonb(r) INTO after_result FROM public.bs_race_results r
 WHERE (race_date,course_code,race_no)=(d,9,11);
 IF before_result IS DISTINCT FROM after_result THEN
   RAISE EXCEPTION 'historical fixture replay changed result/payout';
 END IF;
 RAISE NOTICE 'Historical bootstrap fixture PASS: missing event+six boats restored, results untouched, replay safe';
END $test$;
