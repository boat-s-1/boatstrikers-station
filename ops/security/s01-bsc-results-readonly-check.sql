-- Read-only preflight; run only under separate approval. Save results before any change.
SELECT c.relowner::regrole AS owner, c.relrowsecurity AS rls,
       c.relacl, c.relkind
FROM pg_class c WHERE c.oid = 'public.bsc_results'::regclass;
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public' AND tablename='bsc_results'
ORDER BY policyname;
SELECT grantee, privilege_type, is_grantable
FROM information_schema.table_privileges
WHERE table_schema='public' AND table_name='bsc_results' ORDER BY 1,2;
SELECT attname, attacl FROM pg_attribute
WHERE attrelid='public.bsc_results'::regclass AND attacl IS NOT NULL;
SELECT p.oid::regprocedure AS function, p.proowner::regrole AS owner,
       p.prosecdef, p.proacl, md5(pg_get_functiondef(p.oid)) AS definition_hash
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='bsc_sync_official_results_to_legacy';
-- Effective role privileges must be checked after apply, including inherited grants.
SELECT role_name, privilege, has_table_privilege(role_name,'public.bsc_results',privilege) AS allowed
FROM unnest(ARRAY['anon','authenticated','service_role']) role_name
CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege;
-- Before apply, record the exact three unconditional write-policy names and review
-- pg_get_functiondef/function execute grants plus the API service_role call paths.
-- Generate rollback GRANTs/policy CREATE statements from the observed catalog; do not guess.
SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY policyname),'[]'::jsonb) AS s01_policy_manifest
FROM (SELECT policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
      WHERE schemaname='public' AND tablename='bsc_results') x;
