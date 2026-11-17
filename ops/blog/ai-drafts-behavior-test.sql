-- STAGING BEHAVIOUR TEST for the AI approval rules. Run only AFTER both AI migrations and the 78-row post-check pass,
-- and only with explicit approval. Run as the project owner role (Supabase SQL Editor default).
--
-- NOTHING PERSISTS: the whole test is one DO block that ALWAYS ends by raising an exception, so PostgreSQL rolls back
-- every change it made (test article, AI draft row, approvals, publication), whatever the client's commit mode.
--   Expected result: ERROR  BLOG_AI_BEHAVIOR_TEST_OK: 9 checks passed
--   Any other error (BLOG_AI_BEHAVIOR_TEST_FAILED: <step> ...) means a rule did not behave as designed: stop and report.
-- Existing articles are only read (to prove they are unchanged); no AI generation, no network, no Storage access.
do $behavior_test$
declare
  cat uuid; author uuid; post jsonb; v_post uuid; v bigint; r jsonb; doc jsonb; md5_now text;
  v_slug text := 'zz-ai-behavior-test-' || replace(gen_random_uuid()::text, '-', '');
  existing_before text; existing_after text; passed int := 0;
  function_error text;  -- error message of a call expected to fail (null if it unexpectedly succeeded)
begin
  select string_agg(p.id::text || ':' || p.state || ':' || p.edit_version || ':' || coalesce(p.published_revision_id::text, ''), ',' order by p.id)
    into existing_before from public.blog_posts p;
  select id into cat from public.blog_categories where slug = 'beginner';
  select id into author from public.blog_authors where slug = 'ichika';
  if cat is null or author is null then raise exception 'BLOG_AI_BEHAVIOR_TEST_FAILED: setup (beginner category / ichika author missing)'; end if;

  doc := jsonb_build_object('schema_version',1,'title','AI動作テスト（自動で取り消し）','excerpt','','category_id',cat,'seo','{}'::jsonb,'cover','{}'::jsonb,
    'noindex',true,'author_ids',jsonb_build_array(author),'tag_ids','[]'::jsonb,'relations','[]'::jsonb,
    'blocks',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','TEXT','data',jsonb_build_object('text','テスト本文 v1'))));
  post := public.blog_create_draft(v_slug, doc);
  v_post := (post->>'id')::uuid; v := (post->>'version')::bigint;
  insert into public.blog_ai_drafts(post_id, model, prompt_version, source_pack, validated_version)
    values (v_post, 'behavior-test', 'behavior-test', '{"facts":[]}'::jsonb, v);

  -- 1. An AI draft cannot be published without approval.
  begin perform public.blog_release(v_post, v, null); function_error := null; exception when others then function_error := sqlerrm; end;
  if function_error is distinct from 'BLOG_AI_APPROVAL_REQUIRED' then raise exception 'BLOG_AI_BEHAVIOR_TEST_FAILED: 1 release without approval -> %', coalesce(function_error, 'published'); end if;
  passed := passed + 1;

  -- 2. Nor scheduled.
  begin perform public.blog_release(v_post, v, now() + interval '1 day'); function_error := null; exception when others then function_error := sqlerrm; end;
  if function_error is distinct from 'BLOG_AI_APPROVAL_REQUIRED' then raise exception 'BLOG_AI_BEHAVIOR_TEST_FAILED: 2 schedule without approval -> %', coalesce(function_error, 'scheduled'); end if;
  passed := passed + 1;

  -- 3. Approval stores the approved document, and its fingerprint is the one checked at release.
  r := public.blog_ai_approve(v_post, v, '動作テスト', 'abcdef0123456789', now());
  md5_now := public.blog_ai_document_md5(v_post);
  if not exists (select 1 from public.blog_ai_approvals a where a.id = (r->>'approval_id')::uuid and a.document_md5 = md5_now and md5(a.document::text) = md5_now) then
    raise exception 'BLOG_AI_BEHAVIOR_TEST_FAILED: 3 approval does not store the approved document/fingerprint'; end if;
  passed := passed + 1;

  -- 4. Editing after approval (normal save) makes the approval lapse.
  doc := jsonb_set(doc, '{blocks,0,data,text}', '"テスト本文 v2"');
  r := public.blog_save_draft(v_post, v, doc); v := (r->>'version')::bigint;
  begin perform public.blog_release(v_post, v, null); function_error := null; exception when others then function_error := sqlerrm; end;
  if function_error is distinct from 'BLOG_AI_APPROVAL_REQUIRED' then raise exception 'BLOG_AI_BEHAVIOR_TEST_FAILED: 4 release after edit -> %', coalesce(function_error, 'published'); end if;
  passed := passed + 1;

  -- 5. Approval of a version that was not re-validated is refused.
  begin perform public.blog_ai_approve(v_post, v, '動作テスト', 'abcdef0123456789', now()); function_error := null; exception when others then function_error := sqlerrm; end;
  if function_error is distinct from 'BLOG_AI_NOT_VALIDATED' then raise exception 'BLOG_AI_BEHAVIOR_TEST_FAILED: 5 approve unvalidated version -> %', coalesce(function_error, 'approved'); end if;
  passed := passed + 1;

  -- 6. Content changed behind the version (no save) is detected at release.
  update public.blog_ai_drafts set validated_version = v where blog_ai_drafts.post_id = v_post;
  perform public.blog_ai_approve(v_post, v, '動作テスト', 'abcdef0123456789', now());
  update public.blog_blocks b set data = jsonb_set(b.data, '{text}', '"差し替え"') where b.revision_id = (select editing_revision_id from public.blog_posts where id = v_post);
  begin perform public.blog_release(v_post, v, null); function_error := null; exception when others then function_error := sqlerrm; end;
  if function_error is distinct from 'BLOG_AI_CONTENT_CHANGED' then raise exception 'BLOG_AI_BEHAVIOR_TEST_FAILED: 6 release after hidden change -> %', coalesce(function_error, 'published'); end if;
  passed := passed + 1;

  -- 7. Approvals are append-only.
  begin update public.blog_ai_approvals set approver_name = '改ざん' where blog_ai_approvals.post_id = v_post; function_error := null; exception when others then function_error := sqlerrm; end;
  if function_error is distinct from 'BLOG_AI_APPROVAL_IMMUTABLE' then raise exception 'BLOG_AI_BEHAVIOR_TEST_FAILED: 7 approvals editable -> %', coalesce(function_error, 'updated'); end if;
  passed := passed + 1;

  -- 8. After re-approving the exact current content, release succeeds (rolled back at the end, so nothing is published).
  perform public.blog_ai_approve(v_post, v, '動作テスト', 'abcdef0123456789', now());
  r := public.blog_release(v_post, v, null);
  if r->>'action' <> 'publish' or not exists (select 1 from public.blog_publication_events e where e.post_id = v_post and e.ai_approval_id is not null) then
    raise exception 'BLOG_AI_BEHAVIOR_TEST_FAILED: 8 approved release did not publish with an approval reference'; end if;
  passed := passed + 1;

  -- 9. Existing articles were not touched.
  select string_agg(p.id::text || ':' || p.state || ':' || p.edit_version || ':' || coalesce(p.published_revision_id::text, ''), ',' order by p.id)
    into existing_after from public.blog_posts p where p.id <> v_post;
  if existing_after is distinct from existing_before then raise exception 'BLOG_AI_BEHAVIOR_TEST_FAILED: 9 existing articles changed'; end if;
  passed := passed + 1;

  -- Always end with an exception so every change above is rolled back.
  raise exception 'BLOG_AI_BEHAVIOR_TEST_OK: % checks passed', passed;
end;
$behavior_test$;
