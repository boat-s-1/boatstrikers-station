-- Disposable PostgreSQL 17 fixture only; no real production tables or network.
-- Stub existing RPCs so we can prove transaction ordering and rollback.
CREATE TABLE public.atomic_fixture_writes(phase text NOT NULL, marker text);
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_bootstrap(p_events jsonb,p_entries jsonb,p_synced_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql AS $bootstrap$
BEGIN
 INSERT INTO public.atomic_fixture_writes VALUES('bootstrap','ok');
 INSERT INTO public.bs_race_events(race_date,course_code,race_no)
 SELECT race_date,course_code,race_no FROM jsonb_to_recordset(p_events)
 AS x(race_date date,course_code smallint,race_no smallint)
 ON CONFLICT DO NOTHING;
 INSERT INTO public.bs_race_entries(race_date,course_code,race_no,boat_no,racer_registration_no)
 SELECT race_date,course_code,race_no,boat_no,racer_registration_no
 FROM jsonb_to_recordset(p_entries)
 AS x(race_date date,course_code smallint,race_no smallint,boat_no smallint,racer_registration_no text)
 ON CONFLICT (race_date,course_code,race_no,boat_no) DO UPDATE
 SET racer_registration_no=EXCLUDED.racer_registration_no;
 RETURN '{"ok":true}'::jsonb;
END $bootstrap$;
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_preview(jsonb,timestamptz)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN INSERT INTO public.atomic_fixture_writes VALUES('preview_entries','ok'); RETURN '{"ok":true}'::jsonb; END $$;
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_preview_events(jsonb,timestamptz)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN INSERT INTO public.atomic_fixture_writes VALUES('preview_events','ok'); RETURN '{"ok":true}'::jsonb; END $$;
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_results(jsonb,jsonb,timestamptz)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('bs_fixture.fail_results',true)='yes' THEN
   RAISE EXCEPTION 'fixture injected results failure';
 END IF;
 INSERT INTO public.atomic_fixture_writes VALUES('results','ok');
 RETURN '{"ok":true}'::jsonb;
END $$;
-- Install candidate after stub dependencies, in workflow.
