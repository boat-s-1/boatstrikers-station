-- BLOG only. AI-assisted drafting: categories, official source registry, topic registry,
-- AI draft provenance, human approvals and a release guard for AI drafts.
-- Not applied automatically: staging first, production only after separate approval.
-- Nothing here publishes an article. Publication still requires an explicit blog_release call,
-- and an AI draft can only be released while an approval exists for the exact editing version.
begin;

-- Categories approved for the AI drafting project. DATA LAB keeps its slug; only the display name changes.
insert into public.blog_categories(slug,name,description,position) values
 ('stadium-charm','24場の魅力','各ボートレース場の施設・歴史・グルメなどを、公式情報をもとに紹介します。',10),
 ('stadium-basics','24場の基本','水面・レイアウト・風など、各場の基本を確認済みデータで整理します。',11),
 ('characters','キャラクター','一果・初音・キイナの企画記事です。',12)
on conflict (slug) do nothing;
update public.blog_categories set name='BoatStrikers DATA LAB' where slug='data-lab';

-- URLs that may be fetched for a stadium. official_data comes from the repository's verified
-- BOAT RACE official pages; official_site and manual URLs are registered by an administrator.
create table public.blog_source_urls (
  id uuid primary key default gen_random_uuid(),
  stadium_slug text not null check (stadium_slug ~ '^[a-z]+$'),
  url text not null unique check (url ~ '^https://[^[:space:]]+$' and length(url) <= 2000),
  label text not null check (length(trim(label)) between 1 and 200),
  kind text not null check (kind in ('official_data','official_site','manual')),
  active boolean not null default true,
  registered_by text check (registered_by is null or length(registered_by) <= 80),
  created_at timestamptz not null default now()
);

-- Every fetch attempt is kept (success or failure) with the retrieval time and content hash.
create table public.blog_source_documents (
  id uuid primary key default gen_random_uuid(),
  source_url_id uuid references public.blog_source_urls(id),
  stadium_slug text not null check (stadium_slug ~ '^[a-z]+$'),
  url text not null check (url ~ '^https://'),
  kind text not null check (kind in ('official_data','official_site','manual')),
  fetched_at timestamptz not null,
  http_status integer,
  content_type text,
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  title text check (title is null or length(title) <= 500),
  extracted_text text check (extracted_text is null or length(extracted_text) <= 40000),
  fetch_error text check (fetch_error is null or length(fetch_error) <= 500),
  created_at timestamptz not null default now(),
  check ((fetch_error is null) = (extracted_text is not null))
);
create index blog_source_documents_stadium_fetched on public.blog_source_documents(stadium_slug, fetched_at desc);

-- Topic registry. topic_key is unique, so the same theme cannot be drafted twice.
create table public.blog_topics (
  id uuid primary key default gen_random_uuid(),
  topic_key text not null unique check (topic_key ~ '^[a-z0-9][a-z0-9:_-]{2,199}$'),
  category_slug text not null references public.blog_categories(slug),
  stadium_slug text check (stadium_slug is null or stadium_slug ~ '^[a-z]+$'),
  angle text not null check (angle ~ '^[a-z0-9-]{1,60}$'),
  title_hint text not null check (length(trim(title_hint)) between 1 and 200),
  character_key text check (character_key in ('ichika','hatsune','kiina')),
  status text not null default 'candidate' check (status in ('candidate','drafted','published','rejected')),
  post_id uuid references public.blog_posts(id),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Provenance of an AI-generated draft. One row per AI-originated post.
create table public.blog_ai_drafts (
  post_id uuid primary key references public.blog_posts(id),
  topic_id uuid references public.blog_topics(id),
  model text not null check (length(model) between 1 and 100),
  prompt_version text not null check (length(prompt_version) between 1 and 50),
  generated_at timestamptz not null default now(),
  source_pack jsonb not null check (jsonb_typeof(source_pack) = 'object'),
  validation jsonb not null default '[]'::jsonb check (jsonb_typeof(validation) = 'array'),
  blocking_issues integer not null default 0 check (blocking_issues >= 0),
  validated_version bigint,
  cover_media_id uuid references public.blog_media(id),
  status text not null default 'needs_review' check (status in ('needs_review','approved','rejected')),
  rejected_reason text check (rejected_reason is null or length(rejected_reason) <= 500),
  updated_at timestamptz not null default now()
);

-- Append-only approval log. An approval is bound to one editing revision and one edit_version.
-- Any later save increments edit_version, so the approval stops matching and re-approval is required.
create table public.blog_ai_approvals (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_ai_drafts(post_id),
  revision_id uuid not null references public.blog_post_revisions(id),
  edit_version bigint not null,
  document_md5 text not null check (document_md5 ~ '^[0-9a-f]{32}$'),
  approver_name text not null check (length(trim(approver_name)) between 1 and 80),
  approver_session text not null check (approver_session ~ '^[0-9a-f]{16,64}$'),
  approver_login_at timestamptz,
  created_at timestamptz not null default now()
);
create index blog_ai_approvals_post on public.blog_ai_approvals(post_id, created_at desc);
create function public.blog_ai_approvals_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'BLOG_AI_APPROVAL_IMMUTABLE' using errcode = '55000';
end;
$$;
create trigger blog_ai_approvals_append_only before update or delete on public.blog_ai_approvals
  for each row execute function public.blog_ai_approvals_append_only();

alter table public.blog_publication_events add column ai_approval_id uuid references public.blog_ai_approvals(id);

-- The approval that is valid for the post's current editing revision and version, if any.
create function public.blog_ai_current_approval(p_post_id uuid) returns uuid
language sql stable security invoker set search_path = '' as $$
  select a.id from public.blog_ai_approvals a join public.blog_posts p on p.id = a.post_id
  where a.post_id = p_post_id and a.revision_id = p.editing_revision_id and a.edit_version = p.edit_version
  order by a.created_at desc limit 1;
$$;

create function public.blog_ai_approve(p_post_id uuid, p_expected_version bigint, p_approver_name text,
  p_approver_session text, p_approver_login_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.blog_posts; d public.blog_ai_drafts; doc jsonb; approval uuid;
begin
  select * into p from public.blog_posts where id = p_post_id for update;
  if not found then raise exception 'BLOG_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_expected_version is null or p.edit_version <> p_expected_version then raise exception 'BLOG_EDIT_CONFLICT' using errcode = '40001'; end if;
  select * into d from public.blog_ai_drafts where post_id = p.id for update;
  if not found then raise exception 'BLOG_AI_NOT_AI_DRAFT' using errcode = '22023'; end if;
  if p.editing_revision_id is null then raise exception 'BLOG_AI_NOTHING_TO_APPROVE' using errcode = '22023'; end if;
  -- The server must re-validate the exact version being approved; blocking issues prevent approval.
  if d.validated_version is distinct from p.edit_version then raise exception 'BLOG_AI_NOT_VALIDATED' using errcode = '22023'; end if;
  if d.blocking_issues > 0 then raise exception 'BLOG_AI_BLOCKING_ISSUES' using errcode = '22023'; end if;
  doc := public.blog_editor_document(p.id) -> 'document';
  insert into public.blog_ai_approvals(post_id, revision_id, edit_version, document_md5, approver_name, approver_session, approver_login_at)
    values (p.id, p.editing_revision_id, p.edit_version, md5(doc::text), trim(p_approver_name), p_approver_session, p_approver_login_at)
    returning id into approval;
  update public.blog_ai_drafts set status = 'approved', rejected_reason = null, updated_at = now() where post_id = p.id;
  return jsonb_build_object('approval_id', approval, 'post_id', p.id, 'revision_id', p.editing_revision_id, 'version', p.edit_version);
end;
$$;

-- Same as 20261003174612 blog_release, plus the AI approval guard and the approval reference in the event log.
create or replace function public.blog_release(p_post_id uuid,p_expected_version bigint,p_publish_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.blog_posts; r uuid; action_name text; approval uuid;
begin
  select * into p from public.blog_posts where id=p_post_id for update;
  if not found then raise exception 'BLOG_NOT_FOUND' using errcode='P0002'; end if;
  if p_expected_version is null or p.edit_version <> p_expected_version then raise exception 'BLOG_EDIT_CONFLICT' using errcode='40001'; end if;
  if p.editing_revision_id is null then raise exception 'BLOG_NO_EDITING_REVISION' using errcode='22023'; end if;
  if p.scheduled_revision_id is not null then raise exception 'BLOG_CANCEL_EXISTING_SCHEDULE' using errcode='22023'; end if;
  if p_publish_at is not null and p_publish_at <= now() then raise exception 'BLOG_SCHEDULE_MUST_BE_FUTURE' using errcode='22023'; end if;
  if exists (select 1 from public.blog_ai_drafts where post_id = p.id) then
    approval := public.blog_ai_current_approval(p.id);
    if approval is null then raise exception 'BLOG_AI_APPROVAL_REQUIRED' using errcode='22023'; end if;
  end if;
  r := p.editing_revision_id;
  -- Atomic preparation: storage remains private; only a visible snapshot permits delivery.
  update public.blog_media m set status='public',public_path='/api/blog/media/'||m.id||'.png'
  where m.status='private' and m.id in (
    select nullif(cover->>'media_id','')::uuid from public.blog_post_revisions where id=r
    union select nullif(seo->>'og_media_id','')::uuid from public.blog_post_revisions where id=r
    union select nullif(data->>'media_id','')::uuid from public.blog_blocks where revision_id=r and type='IMAGE'
  );
  perform public.blog_assert_publishable(r);
  update public.blog_post_revisions set state='sealed',sealed_at=now() where id=r;
  if p_publish_at is null then
    action_name := 'publish';
    update public.blog_posts set state='published',published_revision_id=r,editing_revision_id=null,
      first_published_at=coalesce(first_published_at,now()),last_published_at=now(),edit_version=edit_version+1,updated_at=now() where id=p.id;
  else
    action_name := 'schedule';
    update public.blog_posts set scheduled_revision_id=r,scheduled_at=p_publish_at,editing_revision_id=null,
      edit_version=edit_version+1,updated_at=now() where id=p.id;
  end if;
  insert into public.blog_publication_events(post_id,revision_id,action,ai_approval_id) values(p.id,r,action_name,approval);
  return jsonb_build_object('id',p.id,'revision_id',r,'version',p.edit_version+1,'action',action_name,'scheduled_at',p_publish_at);
end;
$$;

do $migration$
declare t text;
begin
  foreach t in array array['blog_source_urls','blog_source_documents','blog_topics','blog_ai_drafts','blog_ai_approvals'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
  foreach t in array array[
    'public.blog_ai_approvals_append_only()',
    'public.blog_ai_current_approval(uuid)',
    'public.blog_ai_approve(uuid,bigint,text,text,timestamptz)',
    'public.blog_release(uuid,bigint,timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated',t);
    execute format('grant execute on function %s to service_role',t);
  end loop;
end;
$migration$;

commit;
