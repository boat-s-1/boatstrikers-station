-- Disposable PostgreSQL CI only. Check caller privileges of the candidate.
-- Production grants must not expose a historical write function to visitors.
DO $test$
DECLARE
 signature regprocedure :=
 'public.bs_apply_openapi_historical_program_candidate(date,jsonb,jsonb,timestamptz)'::regprocedure;
BEGIN
 IF EXISTS (
   SELECT 1 FROM pg_proc p,
     LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE p.oid=signature AND a.grantee=0 AND a.privilege_type='EXECUTE'
 ) OR has_function_privilege('anon',signature,'EXECUTE')
 OR has_function_privilege('authenticated',signature,'EXECUTE') THEN
  RAISE EXCEPTION 'historical candidate executable by untrusted role';
 END IF;
 IF NOT has_function_privilege('service_role',signature,'EXECUTE') THEN
  RAISE EXCEPTION 'historical candidate service_role execute grant missing';
 END IF;
 RAISE NOTICE 'Historical candidate privilege PASS: no PUBLIC/anon/authenticated execute, service_role allowed';
END $test$;
