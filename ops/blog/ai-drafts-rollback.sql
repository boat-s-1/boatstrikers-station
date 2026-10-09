-- ROLLBACK for 20261010090000_blog_ai_followups + 20261009180000_blog_ai_drafts (BLOG only).
-- NOT a migration. Run manually only after separate approval, and only if the AI drafting feature must be removed.
-- Works whether both migrations or only the first one were applied. Runs in one transaction: on any error nothing changes.
--
-- What it does
--   * Restores blog_release exactly as in 20261003174612 (removes the AI approval guard).
--   * DELETES NO HISTORY. Every AI table is MOVED, with all rows, indexes, RLS and the append-only trigger, into the
--     private schema blog_ai_archive (no access for anon/authenticated; read-only for service_role).
--     The approval link of each publication event is copied to blog_ai_archive.publication_event_approvals
--     before the ai_approval_id column is removed from public.blog_publication_events.
--   * Drops only logic (approval functions), never data. Existing articles, revisions, media and publication events are kept.
--   * Removes the 3 added categories only if no article revision uses them; restores the DATA LAB display name.
--
-- It stops without changing anything when:
--   * an AI draft is not yet published, has unpublished edits, or is scheduled (removing the guard would make it
--     publishable without approval) -> handle those drafts first;
--   * the schema blog_ai_archive already exists (a previous archive must never be overwritten) -> rename it first;
--   * the AI tables are not present (nothing to roll back).
begin;

do $precheck$
begin
  if to_regclass('public.blog_ai_drafts') is null then
    raise exception 'BLOG_AI_ROLLBACK: AI drafting tables are not present; nothing to roll back';
  end if;
  if to_regnamespace('blog_ai_archive') is not null then
    raise exception 'BLOG_AI_ROLLBACK: schema blog_ai_archive already exists; rename it before rolling back again';
  end if;
  if exists (select 1 from public.blog_ai_drafts d join public.blog_posts p on p.id = d.post_id
             where p.state <> 'published' or p.editing_revision_id is not null or p.scheduled_revision_id is not null) then
    raise exception 'BLOG_AI_ROLLBACK: unpublished, edited or scheduled AI drafts exist; review them before rolling back';
  end if;
end;
$precheck$;

-- 1. Remove the guard first (the restored function does not reference any AI table).
create or replace function public.blog_release(p_post_id uuid,p_expected_version bigint,p_publish_at timestamptz default null)
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
  insert into public.blog_publication_events(post_id,revision_id,action) values(p.id,r,action_name);
  return jsonb_build_object('id',p.id,'revision_id',r,'version',p.edit_version+1,'action',action_name,'scheduled_at',p_publish_at);
end;
$$;
revoke all on function public.blog_release(uuid,bigint,timestamptz) from public, anon, authenticated;
grant execute on function public.blog_release(uuid,bigint,timestamptz) to service_role;

-- 2. Private archive schema.
create schema blog_ai_archive;
revoke all on schema blog_ai_archive from public, anon, authenticated;
grant usage on schema blog_ai_archive to service_role;

-- 3. Keep which publication used which approval, then remove the column from the live table.
create table blog_ai_archive.publication_event_approvals as
  select e.id as publication_event_id, e.post_id, e.revision_id, e.action, e.created_at, e.ai_approval_id
  from public.blog_publication_events e where e.ai_approval_id is not null;
alter table public.blog_publication_events drop column ai_approval_id;

-- 4. Move every AI table with its data. The follow-up tables may be absent if only the first migration was applied.
alter table if exists public.blog_ai_runs set schema blog_ai_archive;
alter table if exists public.blog_ai_manual_sources set schema blog_ai_archive;
alter table if exists public.blog_post_derivatives set schema blog_ai_archive;
alter table public.blog_ai_approvals set schema blog_ai_archive;
alter table public.blog_ai_drafts set schema blog_ai_archive;
alter table public.blog_topics set schema blog_ai_archive;
alter table public.blog_source_documents set schema blog_ai_archive;
alter table public.blog_source_urls set schema blog_ai_archive;
-- The append-only trigger moves with blog_ai_approvals; keep its function next to it so it keeps protecting the archive.
alter function public.blog_ai_approvals_append_only() set schema blog_ai_archive;

-- 5. Archived rows are history: detach them from live tables (so live articles/categories can change later),
--    keep links between archived tables, and make the archive read-only and private.
do $archive$
declare c record; t record;
begin
  for c in select con.conname, rel.relname from pg_constraint con
           join pg_class rel on rel.oid = con.conrelid
           join pg_class ref on ref.oid = con.confrelid
           where con.contype = 'f' and rel.relnamespace = 'blog_ai_archive'::regnamespace and ref.relnamespace = 'public'::regnamespace loop
    execute format('alter table blog_ai_archive.%I drop constraint %I', c.relname, c.conname);
  end loop;
  for t in select relname from pg_class where relnamespace = 'blog_ai_archive'::regnamespace and relkind = 'r' loop
    execute format('alter table blog_ai_archive.%I enable row level security', t.relname);
    execute format('revoke all on blog_ai_archive.%I from public, anon, authenticated, service_role', t.relname);
    execute format('grant select on blog_ai_archive.%I to service_role', t.relname);
  end loop;
end;
$archive$;

-- 6. Logic only (no data): approval functions.
drop function public.blog_ai_approve(uuid,bigint,text,text,timestamptz);
drop function public.blog_ai_current_approval(uuid);
drop function public.blog_ai_document_md5(uuid);

-- 7. Categories: remove the three added ones only if no article revision uses them; restore the DATA LAB name.
delete from public.blog_categories c where c.slug in ('stadium-charm','stadium-basics','characters')
  and not exists (select 1 from public.blog_post_revisions r where r.category_id = c.id);
update public.blog_categories set name = 'DATA LAB' where slug = 'data-lab';

commit;
