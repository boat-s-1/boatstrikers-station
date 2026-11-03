-- STAGING BEHAVIOUR TEST for 20261103120000_blog_ai_quality_gates.sql (PHASE 2). Run only on the BLOG staging project,
-- after the migration, with explicit approval. Run as the project owner role (SQL Editor default).
--
-- NOTHING PERSISTS: one DO block that ALWAYS ends by raising an exception, so every change (test articles, AI draft
-- rows, gate results, approvals, settings changes, publications, jobs) is rolled back.
--   Expected result: ERROR  BLOG_AI_GATES_BEHAVIOR_TEST_OK: 14 checks passed
--   Any other error (BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: <step> ...) means a rule did not behave as designed.
-- Existing articles are only read, before and after, to prove they are unchanged.
do $behavior_test$
declare
  cat uuid; author uuid; passed int := 0; err text; r jsonb; g jsonb;
  existing_before text; existing_after text;
  p1 uuid; v1 bigint; p2 uuid; v2 bigint; p3 uuid; v3 bigint; p4 uuid; v4 bigint; p5 uuid; v5 bigint;
  pass_gates jsonb := (select jsonb_object_agg(k, jsonb_build_object('verdict','PASS','issues','[]'::jsonb))
    from unnest(array['data_integrity','sources','duplicates','usefulness','seo','copyright','safety']) k);
  hold_gates jsonb;
begin
  hold_gates := jsonb_set(pass_gates, '{data_integrity,verdict}', '"HOLD"');
  select string_agg(p.id::text || ':' || p.state || ':' || p.edit_version || ':' || coalesce(p.published_revision_id::text, '') || ':' || coalesce(p.scheduled_revision_id::text, ''), ',' order by p.id)
    into existing_before from public.blog_posts p;
  select id into cat from public.blog_categories where slug = 'longshot';
  select id into author from public.blog_authors where slug = 'kiina';
  if cat is null or author is null then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: setup (longshot category / kiina author missing)'; end if;

  -- Five AI drafts (created inside this transaction only).
  for i in 1..5 loop
    r := public.blog_create_draft('zz-ai-gates-test-' || i || '-' || replace(gen_random_uuid()::text, '-', ''),
      jsonb_build_object('schema_version',1,'title','品質ゲート動作テスト' || i || '（自動で取り消し）','excerpt','','category_id',cat,'seo','{}'::jsonb,'cover','{}'::jsonb,
        'noindex',true,'author_ids',jsonb_build_array(author),'tag_ids','[]'::jsonb,'relations','[]'::jsonb,
        'blocks',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','TEXT','data',jsonb_build_object('text','テスト本文' || i)))));
    insert into public.blog_ai_drafts(post_id, model, prompt_version, source_pack, validated_version)
      values ((r->>'id')::uuid, 'behavior-test', 'behavior-test', '{}'::jsonb, (r->>'version')::bigint);
    case i when 1 then p1 := (r->>'id')::uuid; v1 := (r->>'version')::bigint; when 2 then p2 := (r->>'id')::uuid; v2 := (r->>'version')::bigint;
      when 3 then p3 := (r->>'id')::uuid; v3 := (r->>'version')::bigint; when 4 then p4 := (r->>'id')::uuid; v4 := (r->>'version')::bigint;
      else p5 := (r->>'id')::uuid; v5 := (r->>'version')::bigint; end case;
  end loop;

  -- 1. Defaults: manual mode, automatic publication and generation off.
  if not exists (select 1 from public.blog_ai_settings where approval_mode = 'manual' and not auto_publish_enabled and not generation_enabled) then
    raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 1 defaults are not manual/off'; end if;
  passed := passed + 1;

  -- 2. While off, a PASS gate result cannot approve.
  g := public.blog_ai_record_gate_result(p1, v1, 0, 'PASS', pass_gates, 'behavior-test', '[]'::jsonb);
  begin perform public.blog_ai_system_approve(p1, v1, (g->>'gate_result_id')::uuid); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'BLOG_AI_AUTO_PUBLISH_DISABLED' then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 2 approve while off -> %', coalesce(err, 'approved'); end if;
  passed := passed + 1;

  -- 3. A PASS verdict with a failing gate is rejected by the table.
  begin perform public.blog_ai_record_gate_result(p1, v1, 0, 'PASS', hold_gates, 'behavior-test', '[]'::jsonb); err := null; exception when others then err := sqlerrm; end;
  if err is null or err not like '%blog_ai_gate_pass_requires_all%' then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 3 forged PASS -> %', coalesce(err, 'stored'); end if;
  passed := passed + 1;

  -- 4. A HOLD verdict cannot be approved away by a human: release and reservation are refused.
  perform public.blog_ai_record_gate_result(p2, v2, 0, 'HOLD', hold_gates, 'behavior-test', '[]'::jsonb);
  perform public.blog_ai_approve(p2, v2, '動作テスト', 'abcdef0123456789', now());
  begin perform public.blog_release(p2, v2, null); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'BLOG_AI_PUBLICATION_NOT_ALLOWED' then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 4a HOLD release -> %', coalesce(err, 'published'); end if;
  begin perform public.blog_release(p2, v2, now() + interval '1 day'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'BLOG_AI_PUBLICATION_NOT_ALLOWED' then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 4b HOLD reservation -> %', coalesce(err, 'scheduled'); end if;
  passed := passed + 1;

  -- 5. A direct row update cannot publish an unapproved AI draft.
  begin
    update public.blog_posts set state = 'published', published_revision_id = editing_revision_id where id = p5; err := null;
  exception when others then err := sqlerrm; end;
  if err is distinct from 'BLOG_AI_PUBLICATION_NOT_ALLOWED' then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 5 direct update -> %', coalesce(err, 'published'); end if;
  passed := passed + 1;

  -- 6. Automatic mode on: a system approval (PASS, same content) lets the article be reserved.
  update public.blog_ai_settings set approval_mode = 'auto', auto_publish_enabled = true, publish_time = '00:00', updated_by = 'behavior-test';
  perform public.blog_ai_system_approve(p1, v1, (g->>'gate_result_id')::uuid);
  r := public.blog_release(p1, v1, now() + interval '1 hour');
  if r->>'action' <> 'schedule' then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 6 system-approved reservation'; end if;
  passed := passed + 1;

  -- 7. Emergency stop: the due reservation is skipped by the reserved-publication worker (no bypass), not published.
  update public.blog_ai_settings set auto_publish_enabled = false, approval_mode = 'manual';
  update public.blog_posts set scheduled_at = now() - interval '1 second' where id = p1;
  r := public.blog_publish_due(20);
  if r @> jsonb_build_array(jsonb_build_object('id', p1)) or exists (select 1 from public.blog_posts where id = p1 and state = 'published') then
    raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 7 stopped AI reservation was published by blog_publish_due'; end if;
  passed := passed + 1;

  -- 8. Switched back on, the worker publishes it.
  update public.blog_ai_settings set approval_mode = 'auto', auto_publish_enabled = true;
  r := public.blog_publish_due(20);
  if not exists (select 1 from public.blog_posts where id = p1 and state = 'published') then
    raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 8 re-enabled reservation not published'; end if;
  passed := passed + 1;

  -- 9. Content changed right before automatic publication: refused, nothing approved.
  g := public.blog_ai_record_gate_result(p3, v3, 0, 'PASS', pass_gates, 'behavior-test', '[]'::jsonb);
  update public.blog_post_revisions set title = '直前の書き換え' where id = (select editing_revision_id from public.blog_posts where id = p3);
  begin perform public.blog_ai_auto_publish(p3, v3, (g->>'gate_result_id')::uuid); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'BLOG_AI_CONTENT_CHANGED' then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 9 changed content -> %', coalesce(err, 'published'); end if;
  if exists (select 1 from public.blog_ai_approvals where post_id = p3) then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 9 approval left behind'; end if;
  passed := passed + 1;

  -- 10. Automatic publication succeeds once per JST day; a second article the same day is refused.
  g := public.blog_ai_record_gate_result(p4, v4, 0, 'PASS', pass_gates, 'behavior-test', '[]'::jsonb);
  r := public.blog_ai_auto_publish(p4, v4, (g->>'gate_result_id')::uuid);
  if not exists (select 1 from public.blog_posts where id = p4 and state = 'published') then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 10a auto publish'; end if;
  g := public.blog_ai_record_gate_result(p5, v5, 0, 'PASS', pass_gates, 'behavior-test', '[]'::jsonb);
  begin perform public.blog_ai_auto_publish(p5, v5, (g->>'gate_result_id')::uuid); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'BLOG_AI_ALREADY_PUBLISHED_TODAY' then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 10b second article -> %', coalesce(err, 'published'); end if;
  passed := passed + 1;

  -- 11. Daily job: a second runner cannot take a leased day; only allowed transitions.
  r := public.blog_ai_job_claim('2099-12-31', 'kiina', 'behavior-a', 600);
  if not (r->>'claimed')::boolean then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 11a claim'; end if;
  r := public.blog_ai_job_claim('2099-12-31', 'kiina', 'behavior-b', 600);
  if (r->>'claimed')::boolean then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 11b double claim'; end if;
  begin perform public.blog_ai_job_transition('2099-12-31', 'behavior-a', 'PUBLISHED', '{}'::jsonb); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'BLOG_AI_JOB_INVALID_TRANSITION' then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 11c transition -> %', coalesce(err, 'moved'); end if;
  passed := passed + 1;

  -- 12. Gate results and automatic publications are append-only.
  begin update public.blog_ai_gate_results set verdict = 'PASS' where post_id = p2; err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'BLOG_AI_GATE_RESULT_IMMUTABLE' then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 12a gate result update -> %', coalesce(err, 'updated'); end if;
  begin delete from public.blog_ai_auto_publications; err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'BLOG_AI_AUTO_PUBLICATION_IMMUTABLE' then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 12b auto publication delete -> %', coalesce(err, 'deleted'); end if;
  passed := passed + 1;

  -- 13. anon / authenticated: no access to the new tables or functions.
  if has_table_privilege('anon', 'public.blog_ai_gate_results', 'select') or has_table_privilege('authenticated', 'public.blog_ai_settings', 'select')
     or has_table_privilege('anon', 'public.blog_ai_jobs', 'select') or has_table_privilege('authenticated', 'public.blog_ai_auto_publications', 'select')
     or has_function_privilege('anon', 'public.blog_ai_auto_publish(uuid,bigint,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.blog_publish_due(integer)', 'execute')
     or has_function_privilege('anon', 'public.blog_ai_system_approve(uuid,bigint,uuid)', 'execute') then
    raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 13 public roles have access'; end if;
  passed := passed + 1;

  -- 14. Existing articles unchanged.
  select string_agg(p.id::text || ':' || p.state || ':' || p.edit_version || ':' || coalesce(p.published_revision_id::text, '') || ':' || coalesce(p.scheduled_revision_id::text, ''), ',' order by p.id)
    into existing_after from public.blog_posts p where p.id not in (p1, p2, p3, p4, p5);
  if existing_after is distinct from existing_before then raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: 14 existing articles changed'; end if;
  passed := passed + 1;

  raise exception 'BLOG_AI_GATES_BEHAVIOR_TEST_OK: % checks passed', passed;
end;
$behavior_test$;
