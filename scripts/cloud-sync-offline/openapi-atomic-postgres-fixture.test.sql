-- Disposable PostgreSQL 17 fixture only; no real production tables or network.
-- Stub existing RPCs so we can prove transaction ordering and rollback.
CREATE TABLE public.atomic_fixture_writes(phase text NOT NULL, marker text);
CREATE OR REPLACE FUNCTION public.bs_apply_openapi_bootstrap(jsonb,jsonb,timestamptz)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN INSERT INTO public.atomic_fixture_writes VALUES('bootstrap','ok'); RETURN '{"ok":true}'::jsonb; END $$;
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
