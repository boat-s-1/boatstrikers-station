-- READ-ONLY. Run in the same BLOG project AFTER applying both AI drafting migrations.
-- One SELECT; returns check / ok (true/false) only. All rows must be true.
select 'blog_release_is_ai_version' as check,
  coalesce((select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure('public.blog_release(uuid,bigint,timestamptz)')) = 'e265c870242487dafc5a585b675a3381', false) as ok
union all select 'blog_ai_approve_present',
  coalesce((select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure('public.blog_ai_approve(uuid,bigint,text,text,timestamptz)')) = '18354bb7cfc70a02b5ca2cf357c0f4a0', false)
union all select 'ai_tables_present',
  to_regclass('public.blog_ai_drafts') is not null and to_regclass('public.blog_topics') is not null and to_regclass('public.blog_ai_approvals') is not null
  and to_regclass('public.blog_source_urls') is not null and to_regclass('public.blog_source_documents') is not null
  and to_regclass('public.blog_post_derivatives') is not null and to_regclass('public.blog_ai_manual_sources') is not null and to_regclass('public.blog_ai_runs') is not null
union all select 'ai_tables_rls_enabled',
  not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname in
    ('blog_ai_drafts','blog_topics','blog_ai_approvals','blog_source_urls','blog_source_documents','blog_post_derivatives','blog_ai_manual_sources','blog_ai_runs') and not relrowsecurity)
union all select 'ai_tables_closed_to_anon_and_authenticated',
  not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated','PUBLIC') and table_name in
    ('blog_ai_drafts','blog_topics','blog_ai_approvals','blog_source_urls','blog_source_documents','blog_post_derivatives','blog_ai_manual_sources','blog_ai_runs'))
union all select 'ai_functions_closed_to_anon_and_authenticated',
  not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'blog\_ai\_%' or p.proname = 'blog_release')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')))
union all select 'new_categories_present',
  (select count(*) from public.blog_categories where slug in ('stadium-charm','stadium-basics','characters') and active) = 3
union all select 'data_lab_display_name', exists (select 1 from public.blog_categories where slug = 'data-lab' and name = 'BoatStrikers DATA LAB');
