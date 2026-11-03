-- BLOG AI quality gates and the automatic-approval mode (PHASE 1).
--
-- Adds BLOG objects only. Race, NEWS, DATA LAB and TRINITY objects are not touched, and blog_release is NOT
-- replaced: it still requires an approval of the current version and content (BLOG_AI_APPROVAL_REQUIRED /
-- BLOG_AI_CONTENT_CHANGED). This migration adds a second kind of approval, recorded by the system, that is
--   * possible only while blog_ai_settings says approval_mode='auto' AND auto_publish_enabled (both off by default),
--   * possible only for a gate result with verdict PASS in all seven required gates, bound by the database to the
--     post's current revision, edit_version and content md5,
--   * honoured at release time only while those settings are still on (switching auto_publish_enabled off is the
--     emergency stop; human approvals keep working as before — the manual approval mode).
-- Not applied anywhere by this change. Apply to the BLOG staging project first, after review.
begin;

do $precheck$
begin
  if to_regclass('public.blog_ai_approvals') is null or to_regclass('public.blog_ai_drafts') is null then
    raise exception 'BLOG_AI_GATES_PRECHECK: 20261009180000_blog_ai_drafts.sql must be applied first';
  end if;
  if to_regclass('public.blog_ai_settings') is not null or to_regclass('public.blog_ai_gate_results') is not null then
    raise exception 'BLOG_AI_GATES_PRECHECK: already applied';
  end if;
end;
$precheck$;

-- One settings row. Automatic approval cannot be enabled without choosing the auto mode first.
create table public.blog_ai_settings (
  id boolean primary key default true check (id),
  approval_mode text not null default 'manual' check (approval_mode in ('manual','auto')),
  auto_publish_enabled boolean not null default false,
  generation_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text check (updated_by is null or length(trim(updated_by)) between 1 and 80),
  constraint blog_ai_settings_auto_requires_mode check (not auto_publish_enabled or approval_mode = 'auto')
);
insert into public.blog_ai_settings(id) values (true);
create function public.blog_ai_settings_keep_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'BLOG_AI_SETTINGS_REQUIRED' using errcode = '55000';
end;
$$;
create trigger blog_ai_settings_keep_row before delete on public.blog_ai_settings
  for each row execute function public.blog_ai_settings_keep_row();

-- Append-only record of every gate run. A PASS verdict requires PASS in each of the seven gates.
create table public.blog_ai_gate_results (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_ai_drafts(post_id),
  revision_id uuid not null references public.blog_post_revisions(id),
  edit_version bigint not null,
  document_md5 text not null check (document_md5 ~ '^[0-9a-f]{32}$'),
  attempt integer not null check (attempt between 0 and 2),
  verdict text not null check (verdict in ('PASS','RETRY','HOLD')),
  gates jsonb not null check (jsonb_typeof(gates) = 'object'
    and gates ?& array['data_integrity','sources','duplicates','usefulness','seo','copyright','safety']),
  gate_version text not null check (length(gate_version) between 1 and 50),
  dataset_hashes jsonb not null default '[]'::jsonb check (jsonb_typeof(dataset_hashes) = 'array'),
  created_at timestamptz not null default clock_timestamp(),
  constraint blog_ai_gate_pass_requires_all check (verdict <> 'PASS' or (
    gates->'data_integrity'->>'verdict' = 'PASS' and gates->'sources'->>'verdict' = 'PASS' and gates->'duplicates'->>'verdict' = 'PASS'
    and gates->'usefulness'->>'verdict' = 'PASS' and gates->'seo'->>'verdict' = 'PASS' and gates->'copyright'->>'verdict' = 'PASS'
    and gates->'safety'->>'verdict' = 'PASS'))
);
create index blog_ai_gate_results_post on public.blog_ai_gate_results(post_id, created_at desc);
create function public.blog_ai_gate_results_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'BLOG_AI_GATE_RESULT_IMMUTABLE' using errcode = '55000';
end;
$$;
create trigger blog_ai_gate_results_append_only before update or delete on public.blog_ai_gate_results
  for each row execute function public.blog_ai_gate_results_append_only();

-- Approvals: who approved. Existing rows are human approvals. A system approval always names its gate result.
alter table public.blog_ai_approvals add column approver_kind text not null default 'human' check (approver_kind in ('human','system'));
alter table public.blog_ai_approvals add column gate_result_id uuid references public.blog_ai_gate_results(id);
alter table public.blog_ai_approvals add constraint blog_ai_approvals_system_has_gate check ((approver_kind = 'system') = (gate_result_id is not null));

-- The current valid approval. Unchanged for human approvals; a system approval counts only while the automatic mode
-- and automatic publication are both on, so turning them off stops every pending automatic release at once.
create or replace function public.blog_ai_current_approval(p_post_id uuid) returns uuid
language sql stable security invoker set search_path = '' as $$
  select a.id from public.blog_ai_approvals a join public.blog_posts p on p.id = a.post_id
  where a.post_id = p_post_id and a.revision_id = p.editing_revision_id and a.edit_version = p.edit_version
    and (a.approver_kind = 'human'
      or exists (select 1 from public.blog_ai_settings s where s.approval_mode = 'auto' and s.auto_publish_enabled))
  order by a.created_at desc limit 1;
$$;

-- Records a gate run for the post's current editing revision. The md5 is computed here, from the stored document,
-- so a caller cannot attach a PASS to content it did not check.
create function public.blog_ai_record_gate_result(p_post_id uuid, p_expected_version bigint, p_attempt integer, p_verdict text,
  p_gates jsonb, p_gate_version text, p_dataset_hashes jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.blog_posts; doc jsonb; rid uuid;
begin
  select * into p from public.blog_posts where id = p_post_id for update;
  if not found then raise exception 'BLOG_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_expected_version is null or p.edit_version <> p_expected_version then raise exception 'BLOG_EDIT_CONFLICT' using errcode = '40001'; end if;
  if not exists (select 1 from public.blog_ai_drafts where post_id = p.id) then raise exception 'BLOG_AI_NOT_AI_DRAFT' using errcode = '22023'; end if;
  if p.editing_revision_id is null then raise exception 'BLOG_AI_NOTHING_TO_APPROVE' using errcode = '22023'; end if;
  doc := (public.blog_editor_document(p.id)) -> 'document';
  insert into public.blog_ai_gate_results(post_id, revision_id, edit_version, document_md5, attempt, verdict, gates, gate_version, dataset_hashes)
    values (p.id, p.editing_revision_id, p.edit_version, md5(doc::text), p_attempt, p_verdict, p_gates, p_gate_version, coalesce(p_dataset_hashes, '[]'::jsonb))
    returning id into rid;
  return jsonb_build_object('gate_result_id', rid, 'verdict', p_verdict, 'version', p.edit_version);
end;
$$;

-- Automatic approval: only in the automatic mode, only for the latest gate result of this exact version and content,
-- and only when it passed every gate. Human approval (blog_ai_approve) is unchanged.
create function public.blog_ai_system_approve(p_post_id uuid, p_expected_version bigint, p_gate_result_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.blog_posts; d public.blog_ai_drafts; g public.blog_ai_gate_results; s public.blog_ai_settings; doc jsonb; approval uuid;
begin
  select * into s from public.blog_ai_settings where id;
  if not found or s.approval_mode <> 'auto' or not s.auto_publish_enabled then raise exception 'BLOG_AI_AUTO_PUBLISH_DISABLED' using errcode = '55000'; end if;
  select * into p from public.blog_posts where id = p_post_id for update;
  if not found then raise exception 'BLOG_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_expected_version is null or p.edit_version <> p_expected_version then raise exception 'BLOG_EDIT_CONFLICT' using errcode = '40001'; end if;
  select * into d from public.blog_ai_drafts where post_id = p.id for update;
  if not found then raise exception 'BLOG_AI_NOT_AI_DRAFT' using errcode = '22023'; end if;
  if p.editing_revision_id is null then raise exception 'BLOG_AI_NOTHING_TO_APPROVE' using errcode = '22023'; end if;
  if d.validated_version is distinct from p.edit_version then raise exception 'BLOG_AI_NOT_VALIDATED' using errcode = '22023'; end if;
  if d.blocking_issues > 0 then raise exception 'BLOG_AI_BLOCKING_ISSUES' using errcode = '22023'; end if;
  select * into g from public.blog_ai_gate_results where id = p_gate_result_id and post_id = p.id;
  if not found then raise exception 'BLOG_AI_GATE_RESULT_NOT_FOUND' using errcode = 'P0002'; end if;
  if g.verdict <> 'PASS' then raise exception 'BLOG_AI_GATE_NOT_PASSED' using errcode = '22023'; end if;
  if g.revision_id <> p.editing_revision_id or g.edit_version <> p.edit_version then raise exception 'BLOG_AI_GATE_STALE' using errcode = '22023'; end if;
  if exists (select 1 from public.blog_ai_gate_results x where x.post_id = p.id and x.edit_version = p.edit_version and x.created_at > g.created_at) then
    raise exception 'BLOG_AI_GATE_SUPERSEDED' using errcode = '22023';
  end if;
  doc := (public.blog_editor_document(p.id)) -> 'document';
  if md5(doc::text) <> g.document_md5 then raise exception 'BLOG_AI_CONTENT_CHANGED' using errcode = '22023'; end if;
  insert into public.blog_ai_approvals(post_id, revision_id, edit_version, document_md5, document, approver_name, approver_session, approver_login_at, approver_kind, gate_result_id)
    values (p.id, p.editing_revision_id, p.edit_version, md5(doc::text), doc, 'system:quality-gate', md5(g.id::text), null, 'system', g.id)
    returning id into approval;
  update public.blog_ai_drafts set status = 'approved', rejected_reason = null, updated_at = now() where post_id = p.id;
  return jsonb_build_object('approval_id', approval, 'post_id', p.id, 'revision_id', p.editing_revision_id, 'version', p.edit_version, 'gate_result_id', g.id);
end;
$$;

do $grants$
declare t text;
begin
  foreach t in array array['blog_ai_settings','blog_ai_gate_results'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
  foreach t in array array[
    'public.blog_ai_settings_keep_row()',
    'public.blog_ai_gate_results_append_only()',
    'public.blog_ai_current_approval(uuid)',
    'public.blog_ai_record_gate_result(uuid,bigint,integer,text,jsonb,text,jsonb)',
    'public.blog_ai_system_approve(uuid,bigint,uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', t);
    execute format('grant execute on function %s to service_role', t);
  end loop;
end;
$grants$;

commit;
