-- PostgreSQL 17 disposable stubs for compile-time checking of Cron candidate.
-- Does not access the network, Supabase or any production service.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE TYPE extensions.http_response AS (
 status integer,content_type text,headers jsonb,content text
);
CREATE OR REPLACE FUNCTION extensions.http_get(url text)
RETURNS extensions.http_response LANGUAGE sql AS $$
 SELECT ROW(503,'application/json','{}'::jsonb,'{}')::extensions.http_response
$$;
-- Verify the candidate is not executable by anonymous or authenticated users.
DO $$
BEGIN
 IF has_function_privilege('anon','public.bs_sync_openapi_today_atomic_candidate()','EXECUTE')
 OR has_function_privilege('authenticated','public.bs_sync_openapi_today_atomic_candidate()','EXECUTE')
 OR NOT has_function_privilege('service_role','public.bs_sync_openapi_today_atomic_candidate()','EXECUTE')
 THEN RAISE EXCEPTION 'atomic Cron candidate privilege regression'; END IF;
END $$;
