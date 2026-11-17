-- READ-ONLY. Run in the target BLOG project's SQL Editor BEFORE applying the AI drafting migrations.
-- One SELECT; returns check / ok (true/false) only. All rows must be true before applying.
-- No secrets, no article content. Expected values come from the repository migrations (tests/blog/aiMigrationCompat.test.mjs).
select 'media_publication_20261003_applied' as check, to_regprocedure('public.blog_media_is_published(uuid)') is not null as ok
union all select 'blog_release_matches_repository_20261003',
  coalesce((select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure('public.blog_release(uuid,bigint,timestamptz)')) = '18a51872abfecdb03c043cedc917299b', false)
union all select 'blog_save_draft_matches_repository',
  coalesce((select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure('public.blog_save_draft(uuid,bigint,jsonb)')) = '9f692d4aefe383a627c4c20533d58ddc', false)
union all select 'blog_editor_document_matches_repository',
  coalesce((select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure('public.blog_editor_document(uuid)')) = '9edd43cd548c2a46f6e380485cbc0967', false)
union all select 'blog_publish_due_matches_repository',
  coalesce((select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure('public.blog_publish_due(integer)')) = '186a60293bd4d71c25f5461b8d7c08c8', false)
union all select 'blog_change_state_matches_repository',
  coalesce((select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure('public.blog_change_state(uuid,bigint,text)')) = '87a9d86257843ff87729ef0b3cd5f358', false)
union all select 'ai_tables_not_yet_created',
  to_regclass('public.blog_ai_drafts') is null and to_regclass('public.blog_topics') is null and to_regclass('public.blog_ai_approvals') is null
  and to_regclass('public.blog_source_urls') is null and to_regclass('public.blog_source_documents') is null
  and to_regclass('public.blog_post_derivatives') is null and to_regclass('public.blog_ai_manual_sources') is null and to_regclass('public.blog_ai_runs') is null
union all select 'publication_events_has_no_ai_column',
  not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blog_publication_events' and column_name = 'ai_approval_id')
union all select 'core_blog_tables_present',
  to_regclass('public.blog_posts') is not null and to_regclass('public.blog_post_revisions') is not null and to_regclass('public.blog_blocks') is not null
  and to_regclass('public.blog_media') is not null and to_regclass('public.blog_categories') is not null and to_regclass('public.blog_authors') is not null
union all select 'character_authors_present',
  (select count(*) from public.blog_authors where slug in ('ichika','hatsune','kiina') and active) = 3
union all select 'new_category_slugs_unused',
  not exists (select 1 from public.blog_categories where slug in ('stadium-charm','stadium-basics','characters'))
union all select 'data_lab_category_present',
  exists (select 1 from public.blog_categories where slug = 'data-lab');
