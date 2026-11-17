SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
LOCK TABLE public.bsc_results IN ACCESS EXCLUSIVE MODE;
DO $guard$
DECLARE r record; manifest jsonb; n integer;
BEGIN
 SELECT c.relowner::regrole::text owner,c.relacl::text acl,c.relrowsecurity rls,c.relkind kind INTO r FROM pg_class c WHERE c.oid='public.bsc_results'::regclass;
 IF r.owner <> 'postgres' OR r.acl IS DISTINCT FROM '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' OR NOT r.rls OR r.kind <> 'r' THEN RAISE EXCEPTION 'S01 table security drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.bsc_results'::regclass AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'S01 column ACL drift'; END IF;
 SELECT count(*) INTO n FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='bsc_sync_official_results_to_legacy';
 IF n<>1 THEN RAISE EXCEPTION 'S01 function overload drift'; END IF;
 SELECT proowner::regrole::text owner,prosecdef secdef,proacl::text acl,md5(pg_get_functiondef(oid)) hash,oid::regprocedure::text signature INTO r FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='bsc_sync_official_results_to_legacy';
 IF r.owner <> 'postgres' OR NOT r.secdef OR r.acl IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' OR r.hash <> '0038e11e13ae845b10a339f03ad236e8' THEN RAISE EXCEPTION 'S01 function drift'; END IF;
 IF has_function_privilege('anon',r.signature,'EXECUTE') OR has_function_privilege('authenticated',r.signature,'EXECUTE') OR NOT has_function_privilege('service_role',r.signature,'EXECUTE') THEN RAISE EXCEPTION 'S01 function permission drift'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY policyname),'[]'::jsonb) INTO manifest FROM (SELECT policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='bsc_results') x;
 IF manifest <> '[{"policyname":"public_delete","permissive":"PERMISSIVE","roles":["anon","authenticated"],"cmd":"DELETE","qual":"true","with_check":null},{"policyname":"public_insert","permissive":"PERMISSIVE","roles":["anon","authenticated"],"cmd":"INSERT","qual":null,"with_check":"true"},{"policyname":"public_select","permissive":"PERMISSIVE","roles":["anon","authenticated"],"cmd":"SELECT","qual":"true","with_check":null},{"policyname":"public_update","permissive":"PERMISSIVE","roles":["anon","authenticated"],"cmd":"UPDATE","qual":"true","with_check":"true"}]'::jsonb THEN RAISE EXCEPTION 'S01 policy drift'; END IF;
END $guard$;
DROP POLICY public_delete ON public.bsc_results;
DROP POLICY public_insert ON public.bsc_results;
DROP POLICY public_update ON public.bsc_results;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.bsc_results FROM PUBLIC,anon,authenticated RESTRICT;
DO $verify$
DECLARE role_name text; privilege_name text;
BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH privilege_name IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
   IF has_table_privilege(role_name,'public.bsc_results',privilege_name) THEN RAISE EXCEPTION 'S01 write privilege remains: % %',role_name,privilege_name; END IF;
  END LOOP;
  IF NOT has_table_privilege(role_name,'public.bsc_results','SELECT') THEN RAISE EXCEPTION 'S01 read privilege lost: %',role_name; END IF;
 END LOOP;
 FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
  IF NOT has_table_privilege('service_role','public.bsc_results',privilege_name) THEN RAISE EXCEPTION 'S01 service role privilege lost: %',privilege_name; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='bsc_results' AND cmd='SELECT' AND policyname='public_select')<>1 THEN RAISE EXCEPTION 'S01 read policy missing'; END IF;
END $verify$;