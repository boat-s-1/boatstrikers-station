-- CI-only settled-race value parity. Uses network-free HTTP mock from negative fixture.
-- Verifies actual SQL Cron mapper values, not just row counts.
CREATE TEMP TABLE pr298_settled_capture (results jsonb, entries jsonb, program jsonb);
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_atomic_candidate(
 p_date date,p_events jsonb,p_entries jsonb,p_preview_entries jsonb,
 p_preview_events jsonb,p_results jsonb,p_result_entries jsonb,
 p_synced_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO pg_temp.pr298_settled_capture VALUES (p_results,p_result_entries,p_entries);
 RETURN jsonb_build_object('ok',true,'captured',true);
END $$;
DO $$
DECLARE d jsonb; r jsonb; e jsonb; program jsonb; response jsonb;
BEGIN
 SELECT doc INTO d FROM public.pr298_document;
 -- Negative fixture ends with malformed stadium. Restore a known-good program.
 d:=jsonb_build_object('programs',jsonb_build_object('stadiums',
  jsonb_build_object('1',jsonb_build_object('stadium_number',1,'races',
   jsonb_build_object('1',jsonb_build_object(
    'date',(now() AT TIME ZONE 'Asia/Tokyo')::date::text,
    'race_number',1,
    'racers',(SELECT jsonb_object_agg(i::text,jsonb_build_object(
      'entry_number',i,'number',(4000+i)::text,
      'national_top_2_percent',42.5,'local_top_2_percent',37.2,
      'flying_count',1,'late_count',2,'motor_top_2_percent',45.5,
      'boat_top_2_percent',33.3,'weight',52.4)) FROM generate_series(1,6) i),
    'result',jsonb_build_object(
      'technique_number_source','逃げ','technique_number',1,'remarks','fixture-note',
      'payouts',jsonb_build_object(
       'trifecta',jsonb_build_array(jsonb_build_object('combination','2-1-3','amount',12340)),
       'exacta',jsonb_build_array(jsonb_build_object('combination','2-1','amount',1500)),
       'quinella',jsonb_build_array(jsonb_build_object('combination','1=2','amount',700)),
       'trio',jsonb_build_array(jsonb_build_object('combination','1=2=3','amount',900))),
      'racers',jsonb_build_object(
       '1',jsonb_build_object('entry_number',1,'place_number',2,'place_number_source','2着','course_number',1,'start_timing',0.13),
       '2',jsonb_build_object('entry_number',2,'place_number',1,'place_number_source','1着','course_number',2,'start_timing',0.11),
       '3',jsonb_build_object('entry_number',3,'place_number',3,'place_number_source','3着','course_number',3,'start_timing',0.15)
      ))
   ))))));
 UPDATE public.pr298_document SET doc=d;
 response:=public.bs_sync_openapi_today_atomic_candidate();
 IF response->>'captured' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'settled capture not invoked'; END IF;
 SELECT t.results,t.entries,t.program INTO r,e,program FROM pg_temp.pr298_settled_capture t LIMIT 1;
 IF jsonb_array_length(r) <> 1 OR jsonb_array_length(e) <> 3
 OR r->0->>'first_boat' IS DISTINCT FROM '2'
 OR r->0->>'second_boat' IS DISTINCT FROM '1'
 OR r->0->>'third_boat' IS DISTINCT FROM '3'
 OR r->0->>'winning_method' IS DISTINCT FROM '逃げ'
 OR r->0->>'technique_code' IS DISTINCT FROM '1'
 OR r->0->>'trifecta_result' IS DISTINCT FROM '2-1-3'
 OR r->0->>'trifecta_payout' IS DISTINCT FROM '12340'
 OR r->0->>'exacta' IS DISTINCT FROM '2-1'
 OR r->0->>'exacta_payout' IS DISTINCT FROM '1500'
 OR r->0->>'quinella' IS DISTINCT FROM '1=2'
 OR r->0->>'quinella_payout' IS DISTINCT FROM '700'
 OR r->0->>'trio' IS DISTINCT FROM '1=2=3'
 OR r->0->>'trio_payout' IS DISTINCT FROM '900'
 THEN RAISE EXCEPTION 'settled result field mapping mismatch: %',r; END IF;
 IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(e) x
   WHERE x->>'boat_no'='2' AND x->>'arrival_order'='1'
   AND x->>'finish_place'='1着' AND x->>'actual_course'='2'
   AND x->>'actual_st'='0.11' AND x->>'result_note'='fixture-note') THEN
  RAISE EXCEPTION 'settled boat entry mapping mismatch: %',e;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(program) x
   WHERE x->>'boat_no'='1' AND x->>'national_2_rate'='42.5'
   AND x->>'local_2_rate'='37.2' AND x->>'flying_count'='1'
   AND x->>'late_count'='2' AND x->>'motor_2_rate'='45.5'
   AND x->>'boat_2_rate'='33.3' AND x->>'racer_weight'='52.4') THEN
  RAISE EXCEPTION 'program numeric value mapping mismatch: %',program;
 END IF;
 RAISE NOTICE 'CRON_SETTLED_VALUE_PARITY=PASS (result payout, placing, boat telemetry, 7 program numeric fields)';
END $$;
