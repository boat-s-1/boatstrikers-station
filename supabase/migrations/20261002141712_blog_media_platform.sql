-- PHASE 1. Additive BLOG-only migration. DO NOT apply to production before review.
-- All administrative RPCs are SECURITY INVOKER, service_role-only.
begin;

create table public.blog_authors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, role text not null default '', bio text not null default '',
  character_key text check (character_key in ('ichika','hatsune','kiina')),
  image_path text, active boolean not null default true
);
create table public.blog_categories (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, description text not null default '', position integer not null default 0,
  active boolean not null default true
);
create table public.blog_tags (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, active boolean not null default true
);
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  state text not null default 'draft' check (state in ('draft','published','unpublished')),
  published_revision_id uuid, editing_revision_id uuid, scheduled_revision_id uuid,
  scheduled_at timestamptz, first_published_at timestamptz, last_published_at timestamptz,
  edit_version bigint not null default 0 check (edit_version >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((scheduled_revision_id is null) = (scheduled_at is null)),
  check (state <> 'published' or (published_revision_id is not null and first_published_at is not null)),
  check (editing_revision_id is distinct from published_revision_id or editing_revision_id is null),
  check (editing_revision_id is distinct from scheduled_revision_id or editing_revision_id is null)
);
create table public.blog_post_revisions (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.blog_posts(id),
  state text not null default 'editing' check (state in ('editing','sealed')),
  schema_version integer not null default 1 check (schema_version = 1),
  title text not null default '', excerpt text not null default '',
  category_id uuid references public.blog_categories(id),
  seo jsonb not null default '{}'::jsonb check (jsonb_typeof(seo) = 'object'),
  cover jsonb not null default '{}'::jsonb check (jsonb_typeof(cover) = 'object'),
  noindex boolean not null default false,
  created_at timestamptz not null default now(), saved_at timestamptz not null default now(),
  sealed_at timestamptz,
  unique (post_id,id),
  check ((state = 'sealed') = (sealed_at is not null))
);
create unique index blog_one_editing_revision on public.blog_post_revisions(post_id) where state = 'editing';
alter table public.blog_posts
  add constraint blog_published_revision_fk foreign key (id,published_revision_id) references public.blog_post_revisions(post_id,id) deferrable initially deferred,
  add constraint blog_editing_revision_fk foreign key (id,editing_revision_id) references public.blog_post_revisions(post_id,id) deferrable initially deferred,
  add constraint blog_scheduled_revision_fk foreign key (id,scheduled_revision_id) references public.blog_post_revisions(post_id,id) deferrable initially deferred;

create table public.blog_blocks (
  revision_id uuid not null references public.blog_post_revisions(id),
  id uuid not null, position integer not null check (position >= 0),
  type text not null check (type in ('TEXT','HEADING','IMAGE','DIALOGUE','DIALOGUE_SCENE','AI_MATE','DATA_CHECK','POINT','WARNING','QUOTE','CTA','RELATED_ARTICLES','RACE_LINK','LIST','TABLE','YOUTUBE')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (revision_id,id), unique (revision_id,position)
);
create table public.blog_post_authors (
  revision_id uuid not null references public.blog_post_revisions(id), author_id uuid not null references public.blog_authors(id),
  position integer not null check (position >= 0), primary key (revision_id,author_id), unique (revision_id,position)
);
create table public.blog_post_tags (
  revision_id uuid not null references public.blog_post_revisions(id), tag_id uuid not null references public.blog_tags(id),
  primary key (revision_id,tag_id)
);
create table public.blog_post_relations (
  revision_id uuid not null references public.blog_post_revisions(id), position integer not null check (position >= 0),
  related_post_id uuid references public.blog_posts(id), existing_path text,
  primary key (revision_id,position), check ((related_post_id is null) <> (existing_path is null)),
  check (existing_path is null or existing_path ~ '^/[^/]')
);
create table public.blog_media (
  id uuid primary key default gen_random_uuid(), storage_path text not null unique,
  status text not null default 'private' check (status in ('private','public')),
  public_path text, alt text not null default '', source text not null default '',
  width integer check (width > 0), height integer check (height > 0),
  created_at timestamptz not null default now(), check (status <> 'public' or public_path is not null)
);
create table public.blog_templates (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null, document jsonb not null check (jsonb_typeof(document) = 'object'),
  schema_version integer not null default 1 check (schema_version = 1)
);
create table public.blog_publication_events (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.blog_posts(id),
  revision_id uuid references public.blog_post_revisions(id),
  action text not null check (action in ('publish','schedule','cancel_schedule','unpublish','scheduled_publish')),
  created_at timestamptz not null default now()
);
create index blog_revisions_post on public.blog_post_revisions(post_id);
create index blog_scheduled_due on public.blog_posts(scheduled_at) where scheduled_revision_id is not null;
create index blog_public_recent on public.blog_posts(first_published_at desc) where state = 'published';
create index blog_revision_category on public.blog_post_revisions(category_id);
create index blog_author_articles on public.blog_post_authors(author_id);
create index blog_tag_articles on public.blog_post_tags(tag_id);
create index blog_related_post on public.blog_post_relations(related_post_id);
create index blog_event_post on public.blog_publication_events(post_id);

-- Frozen versions cannot be modified even by a privileged app client.
create function public.blog_guard_revision() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.state = 'sealed' then raise exception 'BLOG_REVISION_IMMUTABLE' using errcode = '55000'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.post_id <> old.post_id then raise exception 'BLOG_REVISION_OWNER_IMMUTABLE'; end if;
  return new;
end;
$$;
create trigger blog_revision_immutable before update or delete on public.blog_post_revisions
  for each row execute function public.blog_guard_revision();

create function public.blog_guard_revision_child() returns trigger language plpgsql security invoker set search_path = '' as $$
declare revision_state text;
begin
  if tg_op <> 'INSERT' then
    select state into revision_state from public.blog_post_revisions where id = old.revision_id for update;
    if revision_state is distinct from 'editing' then raise exception 'BLOG_REVISION_IMMUTABLE' using errcode = '55000'; end if;
  end if;
  if tg_op <> 'DELETE' then
    select state into revision_state from public.blog_post_revisions where id = new.revision_id for update;
    if revision_state is distinct from 'editing' then raise exception 'BLOG_REVISION_IMMUTABLE' using errcode = '55000'; end if;
    return new;
  end if;
  return old;
end;
$$;

create function public.blog_validate_document(doc jsonb) returns void language plpgsql security invoker set search_path = '' as $$
declare b jsonb; t jsonb; turns jsonb; k text; c text; pose text;
begin
  if jsonb_typeof(doc) is distinct from 'object' or pg_column_size(doc) > 1000000
    or doc->>'schema_version' is distinct from '1'
    or jsonb_typeof(doc->'title') is distinct from 'string'
    or length(doc->>'title') > 200
    or jsonb_typeof(doc->'blocks') is distinct from 'array'
    or jsonb_array_length(doc->'blocks') > 300
    or jsonb_typeof(doc->'author_ids') is distinct from 'array'
    or jsonb_typeof(doc->'tag_ids') is distinct from 'array'
    or jsonb_typeof(doc->'relations') is distinct from 'array'
    or jsonb_typeof(doc->'seo') is distinct from 'object'
    or jsonb_typeof(doc->'cover') is distinct from 'object'
    or jsonb_typeof(doc->'noindex') is distinct from 'boolean'
  then raise exception 'BLOG_INVALID_DOCUMENT' using errcode = '22023'; end if;
  for b in select value from jsonb_array_elements(doc->'blocks') loop
    if jsonb_typeof(b) is distinct from 'object' or jsonb_typeof(b->'data') is distinct from 'object'
      or not (b->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      or b->>'id' is null
      or b->>'type' is null
      or b->>'type' not in ('TEXT','HEADING','IMAGE','DIALOGUE','DIALOGUE_SCENE','AI_MATE','DATA_CHECK','POINT','WARNING','QUOTE','CTA','RELATED_ARTICLES','RACE_LINK','LIST','TABLE','YOUTUBE')
    then raise exception 'BLOG_INVALID_BLOCK' using errcode = '22023'; end if;
    k := b->>'type';
    if k in ('TEXT','POINT','WARNING','QUOTE','DATA_CHECK') and (jsonb_typeof(b->'data'->'text') is distinct from 'string' or length(b->'data'->>'text')>20000)
      then raise exception 'BLOG_INVALID_TEXT' using errcode='22023'; end if;
    if k='HEADING' and (b->'data'->>'level' is null or b->'data'->>'level' not in ('2','3') or jsonb_typeof(b->'data'->'text') is distinct from 'string')
      then raise exception 'BLOG_INVALID_HEADING' using errcode='22023'; end if;
    if k in ('CTA','RACE_LINK','YOUTUBE') and (b->'data'->>'href' is null or not (b->'data'->>'href' ~ '^(https://|/[^/])') or b->'data'->>'href' ~ '[[:space:][:cntrl:]]' or position(chr(92) in b->'data'->>'href')>0)
      then raise exception 'BLOG_INVALID_LINK' using errcode='22023'; end if;
    if k = 'DIALOGUE_SCENE' then
      turns := b->'data'->'turns';
      if jsonb_typeof(turns) is distinct from 'array' then raise exception 'BLOG_INVALID_SCENE' using errcode = '22023'; end if;
      if jsonb_array_length(turns) not between 1 and 100 then raise exception 'BLOG_INVALID_SCENE' using errcode = '22023'; end if;
      if (select count(*) from jsonb_array_elements(turns)) <> (select count(distinct value->>'id') from jsonb_array_elements(turns))
      then raise exception 'BLOG_DUPLICATE_TURN' using errcode = '22023'; end if;
    elsif k in ('DIALOGUE','AI_MATE') then turns := jsonb_build_array(b->'data');
    else continue; end if;
    for t in select value from jsonb_array_elements(turns) loop
      c := t->>'character'; pose := t->>'pose';
      if jsonb_typeof(t) is distinct from 'object'
        or c is null or c not in ('ichika','hatsune','kiina','ichimaru','hatsukoro','kiimoko')
        or pose is null or pose not in ('pose1','pose2','pose3','pose4','pose5','pose6')
        or (pose = 'pose6' and c <> 'ichimaru')
        or t->>'alignment' is null or t->>'alignment' not in ('auto','left','right')
        or jsonb_typeof(t->'text') is distinct from 'string' or length(t->>'text') > 20000
        or (k = 'DIALOGUE' and c not in ('ichika','hatsune','kiina'))
        or (k = 'AI_MATE' and c not in ('ichimaru','hatsukoro','kiimoko'))
        or (k = 'DIALOGUE_SCENE' and (t->>'id' is null or not (t->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')))
      then raise exception 'BLOG_INVALID_TURN' using errcode = '22023'; end if;
    end loop;
  end loop;
end;
$$;

create function public.blog_guard_post() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.first_published_at is not null and new.slug <> old.slug then raise exception 'BLOG_PUBLISHED_SLUG_IMMUTABLE'; end if;
  return new;
end;
$$;
create trigger blog_post_slug_immutable before update on public.blog_posts for each row execute function public.blog_guard_post();
create function public.blog_check_revision_slots() returns trigger language plpgsql security invoker set search_path = '' as $$
declare p public.blog_posts;
begin
  select * into p from public.blog_posts where id = new.id;
  if p.editing_revision_id is not null and not exists (select 1 from public.blog_post_revisions where id=p.editing_revision_id and post_id=p.id and state='editing')
    or p.published_revision_id is not null and not exists (select 1 from public.blog_post_revisions where id=p.published_revision_id and post_id=p.id and state='sealed')
    or p.scheduled_revision_id is not null and not exists (select 1 from public.blog_post_revisions where id=p.scheduled_revision_id and post_id=p.id and state='sealed')
  then raise exception 'BLOG_INVALID_REVISION_SLOT' using errcode='23514'; end if;
  return new;
end;
$$;
create constraint trigger blog_revision_slots after insert or update on public.blog_posts
  deferrable initially deferred for each row execute function public.blog_check_revision_slots();

-- Every save is transactional and uses a monotonically increasing post version.
-- The edit pointer is the only revision pointer save is allowed to change.
create function public.blog_save_draft(p_post_id uuid, p_expected_version bigint, p_document jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.blog_posts; r uuid; b jsonb; item jsonb; i integer;
begin
  perform public.blog_validate_document(p_document);
  select * into p from public.blog_posts where id=p_post_id for update;
  if not found then raise exception 'BLOG_NOT_FOUND' using errcode='P0002'; end if;
  if p_expected_version is null or p.edit_version <> p_expected_version then raise exception 'BLOG_EDIT_CONFLICT' using errcode='40001'; end if;
  r := p.editing_revision_id;
  if r is null then
    insert into public.blog_post_revisions(post_id) values(p.id) returning id into r;
  end if;
  update public.blog_post_revisions set
    title=p_document->>'title', excerpt=coalesce(p_document->>'excerpt',''),
    category_id=nullif(p_document->>'category_id','')::uuid,
    seo=p_document->'seo', cover=p_document->'cover', noindex=(p_document->>'noindex')::boolean,
    saved_at=now() where id=r;
  delete from public.blog_blocks where revision_id=r;
  i := 0;
  for b in select value from jsonb_array_elements(p_document->'blocks') loop
    insert into public.blog_blocks(revision_id,id,position,type,data) values(r,(b->>'id')::uuid,i,b->>'type',b->'data');
    i := i+1;
  end loop;
  delete from public.blog_post_authors where revision_id=r;
  i := 0;
  for item in select value from jsonb_array_elements(p_document->'author_ids') loop
    insert into public.blog_post_authors(revision_id,author_id,position) values(r,(item#>>'{}')::uuid,i); i:=i+1;
  end loop;
  delete from public.blog_post_tags where revision_id=r;
  for item in select value from jsonb_array_elements(p_document->'tag_ids') loop
    insert into public.blog_post_tags(revision_id,tag_id) values(r,(item#>>'{}')::uuid);
  end loop;
  delete from public.blog_post_relations where revision_id=r;
  i:=0;
  for item in select value from jsonb_array_elements(p_document->'relations') loop
    insert into public.blog_post_relations(revision_id,position,related_post_id,existing_path)
      values(r,i,nullif(item->>'post_id','')::uuid,item->>'path'); i:=i+1;
  end loop;
  update public.blog_posts set editing_revision_id=r,edit_version=edit_version+1,updated_at=now() where id=p.id;
  return jsonb_build_object('id',p.id,'revision_id',r,'version',p.edit_version+1,'saved_at',now());
end;
$$;

create function public.blog_create_draft(p_slug text, p_document jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare post_id uuid;
begin
  insert into public.blog_posts(slug) values(p_slug) returning id into post_id;
  return public.blog_save_draft(post_id,0,p_document);
end;
$$;

create function public.blog_editor_document(p_post_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare p public.blog_posts; r public.blog_post_revisions; d jsonb;
begin
  select * into p from public.blog_posts where id=p_post_id for share;
  if not found then raise exception 'BLOG_NOT_FOUND' using errcode='P0002'; end if;
  select * into r from public.blog_post_revisions where id=coalesce(p.editing_revision_id,p.scheduled_revision_id,p.published_revision_id);
  d := jsonb_build_object('schema_version',1,'title',r.title,'excerpt',r.excerpt,'category_id',r.category_id,
    'seo',r.seo,'cover',r.cover,'noindex',r.noindex,
    'blocks',coalesce((select jsonb_agg(jsonb_build_object('id',id,'type',type,'data',data) order by position) from public.blog_blocks where revision_id=r.id),'[]'::jsonb),
    'author_ids',coalesce((select jsonb_agg(author_id order by position) from public.blog_post_authors where revision_id=r.id),'[]'::jsonb),
    'tag_ids',coalesce((select jsonb_agg(tag_id order by tag_id) from public.blog_post_tags where revision_id=r.id),'[]'::jsonb),
    'relations',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('post_id',related_post_id,'path',existing_path)) order by position) from public.blog_post_relations where revision_id=r.id),'[]'::jsonb));
  return jsonb_build_object('id',p.id,'slug',p.slug,'state',p.state,'version',p.edit_version,'scheduled_at',p.scheduled_at,
    'revision_id',r.id,'saved_at',r.saved_at,'document',d);
end;
$$;

create function public.blog_assert_publishable(p_revision_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare r public.blog_post_revisions; b public.blog_blocks;
begin
  select * into r from public.blog_post_revisions where id=p_revision_id;
  if r.title is null or length(trim(r.title))=0 or r.category_id is null
    or not exists(select 1 from public.blog_categories where id=r.category_id and active)
    or not exists(select 1 from public.blog_post_authors a join public.blog_authors c on c.id=a.author_id where a.revision_id=r.id and c.active)
    or not exists(select 1 from public.blog_blocks where revision_id=r.id)
  then raise exception 'BLOG_NOT_PUBLISHABLE' using errcode='22023'; end if;
  for b in select * from public.blog_blocks where revision_id=r.id loop
    if b.type='IMAGE' and not exists(select 1 from public.blog_media where id=nullif(b.data->>'media_id','')::uuid and status='public')
      then raise exception 'BLOG_IMAGE_NOT_PUBLIC' using errcode='22023'; end if;
  end loop;
  if r.cover ? 'media_id' and not exists(select 1 from public.blog_media where id=(r.cover->>'media_id')::uuid and status='public')
    then raise exception 'BLOG_COVER_NOT_PUBLIC' using errcode='22023'; end if;
end;
$$;

create function public.blog_release(p_post_id uuid,p_expected_version bigint,p_publish_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.blog_posts; r uuid; action_name text;
begin
  select * into p from public.blog_posts where id=p_post_id for update;
  if not found then raise exception 'BLOG_NOT_FOUND' using errcode='P0002'; end if;
  if p_expected_version is null or p.edit_version <> p_expected_version then raise exception 'BLOG_EDIT_CONFLICT' using errcode='40001'; end if;
  if p.editing_revision_id is null then raise exception 'BLOG_NO_EDITING_REVISION' using errcode='22023'; end if;
  if p.scheduled_revision_id is not null then raise exception 'BLOG_CANCEL_EXISTING_SCHEDULE' using errcode='22023'; end if;
  if p_publish_at is not null and p_publish_at <= now() then raise exception 'BLOG_SCHEDULE_MUST_BE_FUTURE' using errcode='22023'; end if;
  r := p.editing_revision_id;
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
  insert into public.blog_publication_events(post_id,revision_id,action) values(p.id,r,action_name);
  return jsonb_build_object('id',p.id,'revision_id',r,'version',p.edit_version+1,'action',action_name,'scheduled_at',p_publish_at);
end;
$$;

create function public.blog_clone_revision(p_revision_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare copied uuid;
begin
  insert into public.blog_post_revisions(post_id,title,excerpt,category_id,seo,cover,noindex)
    select post_id,title,excerpt,category_id,seo,cover,noindex from public.blog_post_revisions where id=p_revision_id returning id into copied;
  if copied is null then raise exception 'BLOG_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.blog_blocks select copied,id,position,type,data from public.blog_blocks where revision_id=p_revision_id;
  insert into public.blog_post_authors select copied,author_id,position from public.blog_post_authors where revision_id=p_revision_id;
  insert into public.blog_post_tags select copied,tag_id from public.blog_post_tags where revision_id=p_revision_id;
  insert into public.blog_post_relations select copied,position,related_post_id,existing_path from public.blog_post_relations where revision_id=p_revision_id;
  return copied;
end;
$$;

create function public.blog_change_state(p_post_id uuid,p_expected_version bigint,p_action text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.blog_posts;
begin
  if p_action is null or p_action not in ('cancel_schedule','unpublish') then raise exception 'BLOG_INVALID_ACTION' using errcode='22023'; end if;
  select * into p from public.blog_posts where id=p_post_id for update;
  if not found then raise exception 'BLOG_NOT_FOUND' using errcode='P0002'; end if;
  if p_expected_version is null or p.edit_version <> p_expected_version then raise exception 'BLOG_EDIT_CONFLICT' using errcode='40001'; end if;
  if p.editing_revision_id is null and p.scheduled_revision_id is not null then
    p.editing_revision_id := public.blog_clone_revision(p.scheduled_revision_id);
  end if;
  update public.blog_posts set editing_revision_id=p.editing_revision_id,state=case when p_action='unpublish' then 'unpublished' else state end,
    scheduled_revision_id=null,scheduled_at=null,edit_version=edit_version+1,updated_at=now() where id=p.id;
  insert into public.blog_publication_events(post_id,revision_id,action) values(p.id,p.published_revision_id,p_action);
  return jsonb_build_object('id',p.id,'version',p.edit_version+1,'action',p_action);
end;
$$;

-- No cron is installed by this migration. A separately approved BLOG worker calls this RPC.
create function public.blog_publish_due(p_limit integer default 20) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare p public.blog_posts; published jsonb := '[]'::jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'BLOG_INVALID_LIMIT' using errcode='22023'; end if;
  for p in select * from public.blog_posts where scheduled_revision_id is not null and scheduled_at<=now()
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

create function public.blog_validate_block_row() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  perform public.blog_validate_document(jsonb_build_object('schema_version',1,'title','','blocks',jsonb_build_array(jsonb_build_object('id',new.id,'type',new.type,'data',new.data)),
    'author_ids','[]'::jsonb,'tag_ids','[]'::jsonb,'relations','[]'::jsonb,'seo','{}'::jsonb,'cover','{}'::jsonb,'noindex',false));
  return new;
end;
$$;
create trigger blog_block_validate before insert or update on public.blog_blocks for each row execute function public.blog_validate_block_row();

-- Child guards and grants are restricted to the new BLOG objects only.
do $migration$
declare t text; fn record;
begin
  foreach t in array array['blog_blocks','blog_post_authors','blog_post_tags','blog_post_relations'] loop
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.blog_guard_revision_child()',t || '_immutable',t);
  end loop;
  foreach t in array array['blog_authors','blog_categories','blog_tags','blog_posts','blog_post_revisions','blog_blocks','blog_post_authors','blog_post_tags','blog_post_relations','blog_media','blog_templates','blog_publication_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
  foreach t in array array['blog_authors','blog_categories','blog_tags'] loop
    execute format('grant select on public.%I to anon, authenticated',t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (active)',t || '_public_read',t);
  end loop;
  foreach t in array array['blog_blocks','blog_post_authors','blog_post_tags','blog_post_relations'] loop
    execute format('grant select on public.%I to anon, authenticated',t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (exists (select 1 from public.blog_post_revisions r where r.id = %I.revision_id))',t || '_public_read',t,t);
  end loop;
  for fn in select p.oid::regprocedure as signature from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'blog\_%' escape '\' loop
    execute format('revoke all on function %s from public, anon, authenticated',fn.signature);
    execute format('grant execute on function %s to service_role',fn.signature);
  end loop;
end;
$migration$;

grant select (id,slug,state,published_revision_id,first_published_at,last_published_at) on public.blog_posts to anon,authenticated;
create policy blog_posts_public_read on public.blog_posts for select to anon,authenticated
  using (state='published' and published_revision_id is not null and first_published_at<=now());
grant select on public.blog_post_revisions to anon,authenticated;
create policy blog_revisions_public_read on public.blog_post_revisions for select to anon,authenticated
  using (state='sealed' and exists(select 1 from public.blog_posts p where p.published_revision_id=blog_post_revisions.id));
grant select (id,public_path,alt,source,width,height) on public.blog_media to anon,authenticated;
create policy blog_media_public_read on public.blog_media for select to anon,authenticated using (status='public');

-- Editorial identities/categories only. No race data, statistics or articles are fabricated.
insert into public.blog_authors(slug,name,role,bio,character_key,image_path) values
 ('ichika','一果','イン逃げ・1コース・データ研究','BoatStrikersの編集キャラクター。イン逃げを中心にデータと条件を読み解きます。','ichika','/anime/ichika/C402673C-5EB9-4B09-96CF-9FF4B6138382.png'),
 ('hatsune','初音','女子戦・選手・初心者への補足','BoatStrikersの編集キャラクター。女子戦や選手の情報を初心者にも分かりやすく伝えます。','hatsune','/anime/hatsune/E0C288ED-9FAF-4964-B955-FA5FAB4EEC10.png'),
 ('kiina','キイナ','穴・5アタマ・展開・高配当研究','BoatStrikersの編集キャラクター。読者の疑問から穴条件や展開を考えます。','kiina','/anime/kiina/CA1710C0-A632-4ED3-A1CD-6BDBE9F68F2E.png'),
 ('editorial','BoatStrikers編集部','総合記事・ニュース・運営記事','BoatStrikersの情報を整理・編集する編集部です。',null,null);
insert into public.blog_categories(slug,name,position) values
 ('beginner','初心者',0),('inside-course','イン逃げ',1),('women','女子戦',2),('longshot','穴・5アタマ',3),
 ('data-lab','DATA LAB',4),('stadiums','24場攻略',5),('racers','選手',6),('news','ニュース',7),('columns','コラム',8),('comics','漫画・読み物',9);

comment on table public.blog_post_revisions is 'Editable draft or immutable publication snapshot. Admin autosave never updates a sealed revision.';
comment on table public.blog_blocks is 'DIALOGUE_SCENE stores ordered turns with stable id/character/pose/text/alignment; no HTML source.';
comment on table public.blog_templates is 'Private editorial templates; standard beginner template is validated in code before import.';
commit;
