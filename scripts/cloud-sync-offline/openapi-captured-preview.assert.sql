-- Disposable PostgreSQL only. Captured production preview functions are installed
-- unchanged after bootstrap in a database with no production triggers.
DO $t$
DECLARE d date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
  t timestamptz := now(); v jsonb; n integer;
BEGIN
  PERFORM public.bs_apply_openapi_bootstrap(
    jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',10)),
    (SELECT jsonb_agg(jsonb_build_object('race_date',d,'course_code',9,'race_no',10,
       'boat_no',b,'racer_registration_no',lpad((1000+b)::text,5,'0')))
       FROM generate_series(1,6) b),t);
  -- Existing PC-KYOTEI exhibition data must not be overwritten by API data.
  UPDATE public.bs_race_entries SET exhibition_source='PC-KYOTEI',
    exhibition_time=6.55,exhibition_st=0.10,exhibition_course=1
  WHERE race_date=d AND course_code=9 AND race_no=10 AND boat_no=1;
  v:=public.bs_apply_openapi_preview(
    jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',10,
      'boat_no',1,'exhibition_time',6.72,'exhibition_st',0.19,'exhibition_course',2,
      'tilt',-0.5),
      jsonb_build_object('race_date',d,'course_code',9,'race_no',10,
      'boat_no',2,'exhibition_time',6.68,'exhibition_st',0.12,'exhibition_course',2)),t);
  IF (v->>'updated_rows')::int<>2 THEN RAISE EXCEPTION 'preview update count %',v; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bs_race_entries
    WHERE race_date=d AND course_code=9 AND race_no=10 AND boat_no=1
      AND exhibition_source='PC-KYOTEI' AND exhibition_time=6.55
      AND exhibition_st=0.10 AND exhibition_course=1
      AND api_exhibition_time=6.72 AND api_exhibition_st=0.19
      AND api_exhibition_course=2 AND api_tilt=-0.5)
  THEN RAISE EXCEPTION 'PC-KYOTEI preview priority violated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bs_race_entries
    WHERE race_date=d AND course_code=9 AND race_no=10 AND boat_no=2
      AND exhibition_source='BOATRACE_OPEN_API' AND exhibition_time=6.68)
  THEN RAISE EXCEPTION 'API preview not promoted for empty entry'; END IF;
  UPDATE public.bs_race_events SET wind_speed=8
   WHERE race_date=d AND course_code=9 AND race_no=10;
  v:=public.bs_apply_openapi_preview_events(
    jsonb_build_array(jsonb_build_object('race_date',d,'course_code',9,'race_no',10,
      'wind_speed',3,'wave_height',4,'weather_code','sunny')),t);
  IF (v->>'updated_rows')::int<>1 THEN RAISE EXCEPTION 'preview event update count %',v; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bs_race_events
    WHERE race_date=d AND course_code=9 AND race_no=10
      AND wind_speed=8 AND api_wind_speed=3
      AND wave_height=4 AND api_wave_height=4 AND weather_code='sunny')
  THEN RAISE EXCEPTION 'preview event source priority violated'; END IF;
  SELECT count(*) INTO n FROM public.bs_race_entries
    WHERE race_date=d AND course_code=9 AND race_no=10;
  IF n<>6 THEN RAISE EXCEPTION 'preview altered boat count: %',n; END IF;
  RAISE NOTICE 'Captured real production preview writers PASS: PC priority, API fallback, weather priority, six-boat preservation';
END $t$;
