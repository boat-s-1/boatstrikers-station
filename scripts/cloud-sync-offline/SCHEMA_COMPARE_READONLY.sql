-- Read-only schema comparison query for production vs isolated clone.
WITH targets AS (
 SELECT c.oid,c.relname AS object_name,c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS rls_forced
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('bs_race_events','bs_race_entries','bs_race_results')
), attributes AS (
 SELECT t.object_name,jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY a.attnum) AS definition
 FROM targets t JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum GROUP BY t.object_name
), constraints AS (
 SELECT t.object_name,jsonb_agg(jsonb_build_object('name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY c.conname) AS definition
 FROM targets t JOIN pg_constraint c ON c.conrelid=t.oid GROUP BY t.object_name
), indexes AS (
 SELECT t.object_name,jsonb_agg(jsonb_build_object('name',i.relname,'definition',pg_get_indexdef(i.oid)) ORDER BY i.relname) AS definition
 FROM targets t JOIN pg_index x ON x.indrelid=t.oid JOIN pg_class i ON i.oid=x.indexrelid GROUP BY t.object_name
), triggers AS (
 SELECT t.object_name,jsonb_agg(jsonb_build_object('name',g.tgname,'definition',pg_get_triggerdef(g.oid)) ORDER BY g.tgname) AS definition
 FROM targets t JOIN pg_trigger g ON g.tgrelid=t.oid AND NOT g.tgisinternal GROUP BY t.object_name
), policies AS (
 SELECT t.object_name,jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'qual',pg_get_expr(p.polqual,p.polrelid),'with_check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname) AS definition
 FROM targets t JOIN pg_policy p ON p.polrelid=t.oid GROUP BY t.object_name
)
SELECT t.object_name,t.rls_enabled,t.rls_forced,
 coalesce(a.definition,'[]'::jsonb) AS columns,
 coalesce(c.definition,'[]'::jsonb) AS constraints,
 coalesce(i.definition,'[]'::jsonb) AS indexes,
 coalesce(g.definition,'[]'::jsonb) AS triggers,
 coalesce(p.definition,'[]'::jsonb) AS policies
FROM targets t
LEFT JOIN attributes a USING(object_name)
LEFT JOIN constraints c USING(object_name)
LEFT JOIN indexes i USING(object_name)
LEFT JOIN triggers g USING(object_name)
LEFT JOIN policies p USING(object_name)
ORDER BY t.object_name;
