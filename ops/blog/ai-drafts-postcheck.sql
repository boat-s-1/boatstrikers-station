-- READ-ONLY. Run in the same BLOG project AFTER applying both AI drafting migrations.
-- One SELECT; returns check / ok (true/false) only. Expected: 78 rows (48 table checks + 25 function checks + 5 others), ALL true.
-- Each AI table and each AI-related function is checked individually (no aggregated pass).
--   per table (8 tables x 6): exists, RLS enabled, no policies, no privileges for anon/authenticated
--     (table level incl. PUBLIC inheritance, and column level), service_role can read and write, owned by the same role as blog_posts
--   per function (5 functions x 5): exists, body matches the repository, SECURITY INVOKER,
--     anon/authenticated cannot execute (incl. PUBLIC), service_role can execute
--   plus: append-only trigger, approvals store the approved document, nullable approval column on publication events, categories
with ai_tables(name) as (
  values ('blog_source_urls'), ('blog_source_documents'), ('blog_topics'), ('blog_ai_drafts'),
         ('blog_ai_approvals'), ('blog_post_derivatives'), ('blog_ai_manual_sources'), ('blog_ai_runs')
), client_roles(role_name) as (
  values ('anon'), ('authenticated')
), ai_functions(signature, expected_md5) as (
  values ('public.blog_release(uuid,bigint,timestamptz)', 'f3eed4734217c5229cdcd508defdd252'),
         ('public.blog_ai_approve(uuid,bigint,text,text,timestamptz)', '75a623daa1de5512cb7ff7e4822740a7'),
         ('public.blog_ai_current_approval(uuid)', '7951fc2106f46da1787a2bc4f97e06cb'),
         ('public.blog_ai_document_md5(uuid)', '340966e4d25efe9f7a7b04b5d74a0b09'),
         ('public.blog_ai_approvals_append_only()', '972585b0120c165f9d5a3e0519a7cff4')
), t as (
  select a.name, c.oid, c.relrowsecurity, c.relowner
  from ai_tables a left join pg_class c on c.oid = to_regclass('public.' || a.name)
), f as (
  select a.signature, a.expected_md5, p.oid, p.prosecdef, md5(replace(p.prosrc, chr(13), '')) as body_md5
  from ai_functions a left join pg_proc p on p.oid = to_regprocedure(a.signature)
), checks as (
  select 1 as grp, name as item, 'table_exists:' || name as check_name, oid is not null as ok from t
  union all select 2, name, 'table_rls_enabled:' || name, coalesce(relrowsecurity, false) from t
  union all select 3, name, 'table_has_no_policies:' || name, oid is not null and not exists (select 1 from pg_policy pol where pol.polrelid = t.oid) from t
  union all select 4, name, 'table_closed_to_anon_and_authenticated:' || name,
    oid is not null and not exists (select 1 from client_roles r where
      has_table_privilege(r.role_name, t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_any_column_privilege(r.role_name, t.oid, 'SELECT,INSERT,UPDATE,REFERENCES')) from t
  union all select 5, name, 'table_service_role_read_write:' || name,
    oid is not null and has_table_privilege('service_role', t.oid, 'SELECT') and has_table_privilege('service_role', t.oid, 'INSERT')
    and has_table_privilege('service_role', t.oid, 'UPDATE') and has_table_privilege('service_role', t.oid, 'DELETE') from t
  union all select 6, name, 'table_owner_same_as_blog_posts:' || name,
    oid is not null and relowner = (select relowner from pg_class where oid = to_regclass('public.blog_posts')) from t
  union all select 7, signature, 'function_exists:' || signature, oid is not null from f
  union all select 8, signature, 'function_body_matches_repository:' || signature, coalesce(body_md5 = expected_md5, false) from f
  union all select 9, signature, 'function_security_invoker:' || signature, oid is not null and not prosecdef from f
  union all select 10, signature, 'function_closed_to_anon_and_authenticated:' || signature,
    oid is not null and not exists (select 1 from client_roles r where has_function_privilege(r.role_name, f.oid, 'EXECUTE')) from f
  union all select 11, signature, 'function_service_role_execute:' || signature, oid is not null and has_function_privilege('service_role', f.oid, 'EXECUTE') from f
  union all select 12, 'trigger', 'approvals_append_only_trigger_enabled',
    exists (select 1 from pg_trigger tg where tg.tgrelid = to_regclass('public.blog_ai_approvals') and tg.tgname = 'blog_ai_approvals_append_only' and tg.tgenabled <> 'D')
  union all select 13, 'column', 'approvals_store_approved_document',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blog_ai_approvals' and column_name = 'document' and is_nullable = 'NO')
    and exists (select 1 from pg_constraint where conrelid = to_regclass('public.blog_ai_approvals') and contype = 'c' and pg_get_constraintdef(oid) like '%md5((document)::text)%')
  union all select 13, 'column', 'publication_events_ai_approval_id_nullable',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blog_publication_events' and column_name = 'ai_approval_id' and is_nullable = 'YES')
  union all select 14, 'categories', 'new_categories_present',
    (select count(*) from public.blog_categories where slug in ('stadium-charm','stadium-basics','characters') and active) = 3
  union all select 15, 'categories', 'data_lab_display_name',
    exists (select 1 from public.blog_categories where slug = 'data-lab' and name = 'BoatStrikers DATA LAB')
)
select check_name as check, ok from checks order by grp, item;
