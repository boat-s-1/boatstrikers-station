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
-- PHASE 2 additions: one guard for every publication path (immediate release, reservation and the reserved-publication
-- worker), so neither a reservation nor a HOLD verdict can bypass the gates; an atomic one-per-JST-day automatic
-- publication; and the daily job table whose states and leases prevent double runs.
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
  -- Functions replaced below must be exactly the repository versions (20261002141712 / 20261009180000).
  if (select md5(prosrc) from pg_proc where oid = 'public.blog_publish_due(integer)'::regprocedure) <> '186a60293bd4d71c25f5461b8d7c08c8'
     or (select md5(prosrc) from pg_proc where oid = 'public.blog_ai_current_approval(uuid)'::regprocedure) <> '7951fc2106f46da1787a2bc4f97e06cb'
     or (select md5(prosrc) from pg_proc where oid = 'public.blog_release(uuid,bigint,timestamptz)'::regprocedure) <> 'f3eed4734217c5229cdcd508defdd252' then
    raise exception 'BLOG_AI_GATES_PRECHECK: blog_publish_due / blog_ai_current_approval / blog_release differ from the repository versions';
  end if;
end;
$precheck$;

-- One settings row. Automatic approval cannot be enabled without choosing the auto mode first.
create table public.blog_ai_settings (
  id boolean primary key default true check (id),
  approval_mode text not null default 'manual' check (approval_mode in ('manual','auto')),
  auto_publish_enabled boolean not null default false,
  generation_enabled boolean not null default false,
  -- Automatic publication never happens before this time of day (JST).
  publish_time time not null default '06:00',
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

-- ===================== PHASE 2: no publication path may bypass the gates =====================

-- Whether a revision of a post may become public or be reserved. Not an AI draft: always (human articles unchanged).
-- An AI draft: an approval of exactly this revision must exist — a human approval, or a system approval while the
-- automatic mode and automatic publication are on — and the latest gate result for the approved version must not be
-- HOLD (a human cannot approve away a HOLD verdict on the same content; editing creates a new version to re-check).
create function public.blog_ai_release_allowed(p_post_id uuid, p_revision_id uuid) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare a record; latest text;
begin
  if not exists (select 1 from public.blog_ai_drafts where post_id = p_post_id) then return true; end if;
  for a in select x.edit_version, x.approver_kind from public.blog_ai_approvals x
    where x.post_id = p_post_id and x.revision_id = p_revision_id order by x.created_at desc loop
    if a.approver_kind = 'system' and not exists (select 1 from public.blog_ai_settings s where s.approval_mode = 'auto' and s.auto_publish_enabled) then
      continue;
    end if;
    select g.verdict into latest from public.blog_ai_gate_results g
      where g.post_id = p_post_id and g.revision_id = p_revision_id and g.edit_version = a.edit_version
      order by g.created_at desc limit 1;
    if latest is distinct from 'HOLD' then return true; end if;
  end loop;
  return false;
end;
$$;

-- Guard on the post row itself: making a revision public or reserving it is checked whatever function does it
-- (blog_release now or scheduled, blog_publish_due, or a direct update by a privileged role).
create function public.blog_ai_guard_publication() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (new.published_revision_id is not null and new.published_revision_id is distinct from old.published_revision_id
        and not public.blog_ai_release_allowed(new.id, new.published_revision_id))
     or (new.scheduled_revision_id is not null and new.scheduled_revision_id is distinct from old.scheduled_revision_id
        and not public.blog_ai_release_allowed(new.id, new.scheduled_revision_id)) then
    raise exception 'BLOG_AI_PUBLICATION_NOT_ALLOWED' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger blog_ai_guard_publication before update of published_revision_id, scheduled_revision_id on public.blog_posts
  for each row execute function public.blog_ai_guard_publication();

-- Same as 20261002141712 blog_publish_due, plus one condition: a due reservation that is no longer allowed (automatic
-- publication switched off, or HOLD) is skipped instead of published. Skipping, not raising, so one stopped AI
-- reservation never blocks the other articles of the batch; it stays overdue and visible until cancelled.
create or replace function public.blog_publish_due(p_limit integer default 20) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare p public.blog_posts; published jsonb := '[]'::jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'BLOG_INVALID_LIMIT' using errcode='22023'; end if;
  for p in select * from public.blog_posts where scheduled_revision_id is not null and scheduled_at<=now()
    and public.blog_ai_release_allowed(id, scheduled_revision_id)
    order by scheduled_at for update skip locked limit p_limit loop
    perform public.blog_assert_publishable(p.scheduled_revision_id);
    update public.blog_posts set state='published',published_revision_id=p.scheduled_revision_id,
      scheduled_revision_id=null,scheduled_at=null,first_published_at=coalesce(first_published_at,p.scheduled_at),
      last_published_at=p.scheduled_at,edit_version=edit_version+1,updated_at=now() where id=p.id;
    insert into public.blog_publication_events(post_id,revision_id,action) values(p.id,p.scheduled_revision_id,'scheduled_publish');
    published := published || jsonb_build_array(jsonb_build_object('id',p.id,'slug',p.slug,'revision_id',p.scheduled_revision_id));
  end loop;
  return published;
end;
$$;

-- JST wall-clock time (no daylight saving in Japan; avoids depending on the server's time zone database).
create function public.blog_ai_jst_now() returns timestamp
language sql stable security invoker set search_path = '' as $$ select (now() at time zone 'UTC') + interval '9 hours'; $$;

-- One automatic publication per JST day, enforced by the primary key (a concurrent second run fails and rolls back).
create table public.blog_ai_auto_publications (
  publish_date date primary key,
  post_id uuid not null references public.blog_ai_drafts(post_id),
  gate_result_id uuid not null references public.blog_ai_gate_results(id),
  approval_id uuid not null references public.blog_ai_approvals(id),
  created_at timestamptz not null default clock_timestamp()
);
create function public.blog_ai_auto_publications_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'BLOG_AI_AUTO_PUBLICATION_IMMUTABLE' using errcode = '55000';
end;
$$;
create trigger blog_ai_auto_publications_append_only before update or delete on public.blog_ai_auto_publications
  for each row execute function public.blog_ai_auto_publications_append_only();

-- Automatic publication in one transaction: settings and time → system approval (all its checks) → immediate release
-- (blog_release, unchanged, plus the guard) → the day's record. Any failure leaves nothing approved or published.
create function public.blog_ai_auto_publish(p_post_id uuid, p_expected_version bigint, p_gate_result_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.blog_ai_settings; jst timestamp := public.blog_ai_jst_now(); approved jsonb; released jsonb;
begin
  select * into s from public.blog_ai_settings where id;
  if not found or s.approval_mode <> 'auto' or not s.auto_publish_enabled then raise exception 'BLOG_AI_AUTO_PUBLISH_DISABLED' using errcode = '55000'; end if;
  if jst::time < s.publish_time then raise exception 'BLOG_AI_BEFORE_PUBLISH_TIME' using errcode = '55000'; end if;
  if exists (select 1 from public.blog_ai_auto_publications where publish_date = jst::date) then
    raise exception 'BLOG_AI_ALREADY_PUBLISHED_TODAY' using errcode = '23505';
  end if;
  approved := public.blog_ai_system_approve(p_post_id, p_expected_version, p_gate_result_id);
  released := public.blog_release(p_post_id, p_expected_version, null);
  insert into public.blog_ai_auto_publications(publish_date, post_id, gate_result_id, approval_id)
    values (jst::date, p_post_id, p_gate_result_id, (approved->>'approval_id')::uuid);
  return jsonb_build_object('publish_date', jst::date, 'post_id', p_post_id, 'approval_id', approved->>'approval_id', 'version', released->>'version');
end;
$$;

-- Daily jobs: one row per JST publication date. States and allowed transitions are enforced here; a lease prevents
-- two runs from working on the same day at once.
create table public.blog_ai_jobs (
  publish_date date primary key,
  character_key text not null check (character_key in ('ichika','hatsune','kiina')),
  state text not null default 'PLANNED' check (state in ('PLANNED','GENERATING','GENERATED','VALIDATING','RETRY','APPROVED','PUBLISHING','PUBLISHED','HOLD','FAILED')),
  topic_id uuid references public.blog_topics(id),
  post_id uuid references public.blog_ai_drafts(post_id),
  gate_result_id uuid references public.blog_ai_gate_results(id),
  attempt integer not null default 0 check (attempt between 0 and 2),
  lease_owner text check (lease_owner is null or length(lease_owner) between 1 and 100),
  lease_until timestamptz,
  last_error text check (last_error is null or length(last_error) <= 500),
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.blog_ai_job_transition_allowed(p_from text, p_to text) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select (p_from, p_to) in (
    ('PLANNED','GENERATING'), ('PLANNED','HOLD'), ('PLANNED','FAILED'),
    ('GENERATING','GENERATED'), ('GENERATING','HOLD'), ('GENERATING','FAILED'),
    ('GENERATED','VALIDATING'),
    ('VALIDATING','APPROVED'), ('VALIDATING','RETRY'), ('VALIDATING','HOLD'), ('VALIDATING','FAILED'),
    ('RETRY','GENERATING'), ('RETRY','HOLD'), ('RETRY','FAILED'),
    ('APPROVED','PUBLISHING'), ('APPROVED','HOLD'),
    ('PUBLISHING','PUBLISHED'), ('PUBLISHING','FAILED'),
    ('FAILED','PLANNED'));
$$;

-- Claim the day's job (created on first claim). Returns claimed=false while another owner's lease is valid or when the
-- job is finished (PUBLISHED / HOLD). A lease expires on its own, so a crashed run does not block the day.
create function public.blog_ai_job_claim(p_date date, p_character text, p_owner text, p_lease_seconds integer default 900)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare j public.blog_ai_jobs;
begin
  if p_lease_seconds is null or p_lease_seconds not between 30 and 3600 then raise exception 'BLOG_AI_INVALID_LEASE' using errcode = '22023'; end if;
  insert into public.blog_ai_jobs(publish_date, character_key) values (p_date, p_character) on conflict (publish_date) do nothing;
  select * into j from public.blog_ai_jobs where publish_date = p_date for update;
  if j.state in ('PUBLISHED','HOLD') then return jsonb_build_object('claimed', false, 'reason', 'finished', 'job', to_jsonb(j)); end if;
  if j.lease_until is not null and j.lease_until > now() and j.lease_owner is distinct from p_owner then
    return jsonb_build_object('claimed', false, 'reason', 'leased', 'job', to_jsonb(j));
  end if;
  update public.blog_ai_jobs set lease_owner = p_owner, lease_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
    where publish_date = p_date returning * into j;
  return jsonb_build_object('claimed', true, 'job', to_jsonb(j));
end;
$$;

-- Move the job to another state. Only the lease holder may do it, only along an allowed transition. RETRY→GENERATING
-- counts a regeneration (at most 2). p_patch may set topic_id, post_id, gate_result_id and last_error.
create function public.blog_ai_job_transition(p_date date, p_owner text, p_to text, p_patch jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare j public.blog_ai_jobs;
begin
  select * into j from public.blog_ai_jobs where publish_date = p_date for update;
  if not found then raise exception 'BLOG_AI_JOB_NOT_FOUND' using errcode = 'P0002'; end if;
  if j.lease_owner is distinct from p_owner or j.lease_until is null or j.lease_until <= now() then raise exception 'BLOG_AI_JOB_NOT_LEASED' using errcode = '55000'; end if;
  if not public.blog_ai_job_transition_allowed(j.state, p_to) then raise exception 'BLOG_AI_JOB_INVALID_TRANSITION' using errcode = '22023'; end if;
  update public.blog_ai_jobs set
    state = p_to,
    attempt = case when j.state = 'RETRY' and p_to = 'GENERATING' then j.attempt + 1 else j.attempt end,
    topic_id = coalesce((p_patch->>'topic_id')::uuid, topic_id),
    post_id = coalesce((p_patch->>'post_id')::uuid, post_id),
    gate_result_id = coalesce((p_patch->>'gate_result_id')::uuid, gate_result_id),
    last_error = case when p_patch ? 'last_error' then left(p_patch->>'last_error', 500) else last_error end,
    lease_owner = case when p_to in ('PUBLISHED','HOLD','FAILED') then null else lease_owner end,
    lease_until = case when p_to in ('PUBLISHED','HOLD','FAILED') then null else lease_until end,
    history = history || jsonb_build_array(jsonb_build_object('from', j.state, 'to', p_to, 'at', now())),
    updated_at = now()
  where publish_date = p_date returning * into j;
  return to_jsonb(j);
end;
$$;

-- Give the lease back at the end of a run (only the holder can), so the next scheduled call continues at once.
create function public.blog_ai_job_release(p_date date, p_owner text) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.blog_ai_jobs set lease_owner = null, lease_until = null, updated_at = now()
    where publish_date = p_date and lease_owner = p_owner;
  return found;
end;
$$;

do $grants$
declare t text;
begin
  foreach t in array array['blog_ai_settings','blog_ai_gate_results','blog_ai_auto_publications','blog_ai_jobs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
  foreach t in array array[
    'public.blog_ai_settings_keep_row()',
    'public.blog_ai_gate_results_append_only()',
    'public.blog_ai_current_approval(uuid)',
    'public.blog_ai_record_gate_result(uuid,bigint,integer,text,jsonb,text,jsonb)',
    'public.blog_ai_system_approve(uuid,bigint,uuid)',
    'public.blog_ai_release_allowed(uuid,uuid)',
    'public.blog_ai_guard_publication()',
    'public.blog_publish_due(integer)',
    'public.blog_ai_jst_now()',
    'public.blog_ai_auto_publications_append_only()',
    'public.blog_ai_auto_publish(uuid,bigint,uuid)',
    'public.blog_ai_job_transition_allowed(text,text)',
    'public.blog_ai_job_claim(date,text,text,integer)',
    'public.blog_ai_job_transition(date,text,text,jsonb)',
    'public.blog_ai_job_release(date,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', t);
    execute format('grant execute on function %s to service_role', t);
  end loop;
end;
$grants$;

commit;
