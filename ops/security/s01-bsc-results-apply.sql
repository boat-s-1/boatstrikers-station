-- REVIEW CANDIDATE ONLY; NOT a migration. psql variables are mandatory, no defaults.
-- s01_backup_verified=yes, s01_owner, s01_table_acl, s01_function_hash,
-- s01_function_acl, s01_policy_manifest (JSON of pg_policies rows ordered by name).
-- Capture/review these values from a fresh read-only preflight first.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
SELECT set_config('s01.backup', :'s01_backup_verified', true),
 set_config('s01.owner', :'s01_owner', true),
 set_config('s01.acl', :'s01_table_acl', true),
 set_config('s01.function_hash', :'s01_function_hash', true),
 set_config('s01.function_acl', :'s01_function_acl', true),
 set_config('s01.policies', :'s01_policy_manifest', true);
LOCK TABLE public.bsc_results IN ACCESS EXCLUSIVE MODE;
DO $guard$
DECLARE actual jsonb; r record; p record; count_write integer := 0;
BEGIN
 IF current_setting('s01.backup') <> 'yes' THEN RAISE EXCEPTION 'Verified backup required'; END IF;
 SELECT relowner::regrole::text AS owner, relrowsecurity AS rls, relacl::text AS acl, relkind
 INTO r FROM pg_class WHERE oid='public.bsc_results'::regclass;
 IF r.owner <> current_setting('s01.owner') OR r.acl IS DISTINCT FROM current_setting('s01.acl')
    OR NOT r.rls OR r.relkind <> 'r' THEN RAISE EXCEPTION 'Table security drift'; END IF;
 IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.bsc_results'::regclass
            AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'Review column ACLs separately'; END IF;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace
     AND proname='bsc_sync_official_results_to_legacy') <> 1 THEN RAISE EXCEPTION 'Function overload drift'; END IF;
 SELECT oid::regprocedure::text AS signature, proowner::regrole::text AS owner, prosecdef AS secdef, proacl::text AS acl,
        md5(pg_get_functiondef(oid)) AS hash INTO r FROM pg_proc
 WHERE pronamespace='public'::regnamespace AND proname='bsc_sync_official_results_to_legacy';
 IF r.owner <> 'postgres' OR NOT r.secdef OR r.hash <> current_setting('s01.function_hash')
 OR r.acl IS DISTINCT FROM current_setting('s01.function_acl') THEN RAISE EXCEPTION 'Function drift'; END IF;
 IF has_function_privilege('anon',r.signature,'EXECUTE') OR
    has_function_privilege('authenticated',r.signature,'EXECUTE') OR
    NOT has_function_privilege('service_role',r.signature,'EXECUTE')
 THEN RAISE EXCEPTION 'Function execute privileges differ from service-only review'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY policyname),'[]'::jsonb) INTO actual
 FROM (SELECT policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
       WHERE schemaname='public' AND tablename='bsc_results') x;
 IF actual <> current_setting('s01.policies')::jsonb THEN RAISE EXCEPTION 'Policy drift'; END IF;
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename='bsc_results'
 LOOP
   IF p.cmd IN ('INSERT','UPDATE','DELETE') THEN
     IF p.permissive <> 'PERMISSIVE' OR
        (p.cmd IN ('UPDATE','DELETE') AND p.qual IS DISTINCT FROM 'true') OR
        (p.cmd IN ('INSERT','UPDATE') AND p.with_check IS DISTINCT FROM 'true')
     THEN RAISE EXCEPTION 'Unexpected write policy'; END IF;
     count_write := count_write+1;
   ELSIF p.cmd <> 'SELECT' THEN RAISE EXCEPTION 'Unexpected ALL policy'; END IF;
 END LOOP;
 IF count_write <> 3 THEN RAISE EXCEPTION 'Expected exactly 3 reviewed write policies'; END IF;
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public'
   AND tablename='bsc_results' AND cmd IN ('INSERT','UPDATE','DELETE')
 LOOP EXECUTE format('DROP POLICY %I ON public.bsc_results',p.policyname); END LOOP;
END $guard$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.bsc_results
 FROM PUBLIC, anon, authenticated RESTRICT;
DO $verify$
DECLARE r text; priv text;
BEGIN
 IF current_setting('server_version_num')::int >= 170000 THEN
   EXECUTE 'REVOKE MAINTAIN ON public.bsc_results FROM PUBLIC, anon, authenticated RESTRICT';
 END IF;
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   FOREACH priv IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
     IF has_table_privilege(r,'public.bsc_results',priv) THEN RAISE EXCEPTION 'Inherited privilege remains: % %',r,priv; END IF;
   END LOOP;
   IF current_setting('server_version_num')::int >= 170000 THEN
     IF has_table_privilege(r,'public.bsc_results','MAINTAIN') THEN RAISE EXCEPTION 'MAINTAIN remains'; END IF;
   END IF;
   IF NOT has_table_privilege(r,'public.bsc_results','SELECT') THEN RAISE EXCEPTION 'Public SELECT unavailable'; END IF;
 END LOOP;
 FOREACH priv IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
   IF NOT has_table_privilege('service_role','public.bsc_results',priv) THEN
     RAISE EXCEPTION 'service_role privilege unavailable: %',priv; END IF;
 END LOOP;
END $verify$;
COMMIT;
