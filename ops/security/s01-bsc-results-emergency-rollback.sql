-- READ-ONLY GENERATOR. Run BEFORE apply and save the generated statements.
-- Execution of generated rollback requires separate approval: it reopens write access.
WITH statements AS (
SELECT 0 AS ordinal, 'BEGIN; SET LOCAL lock_timeout = ''3s'';' AS statement
UNION ALL
SELECT 1, format('GRANT %s ON TABLE public.bsc_results TO %s%s;',
 a.privilege_type, CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(a.grantee::regrole::text) END,
 CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
WHERE c.oid='public.bsc_results'::regclass
 AND (a.grantee=0 OR a.grantee IN ('anon'::regrole,'authenticated'::regrole))
 AND a.privilege_type <> 'SELECT'
UNION ALL
SELECT 2, format('CREATE POLICY %I ON public.bsc_results AS %s FOR %s TO %s%s%s;',
 policyname,permissive,cmd,
 array_to_string(ARRAY(SELECT CASE WHEN r='public' THEN 'PUBLIC' ELSE quote_ident(r) END FROM unnest(roles) r),','),
 CASE WHEN qual IS NULL THEN '' ELSE ' USING ('||qual||')' END,
 CASE WHEN with_check IS NULL THEN '' ELSE ' WITH CHECK ('||with_check||')' END)
FROM pg_policies WHERE schemaname='public' AND tablename='bsc_results'
 AND cmd IN ('INSERT','UPDATE','DELETE')
UNION ALL SELECT 3, 'COMMIT;'
)
SELECT string_agg(statement, E'\n' ORDER BY ordinal, statement) AS rollback_sql
FROM statements;
-- Compare generated grants/policies with the saved catalog before any execution.
