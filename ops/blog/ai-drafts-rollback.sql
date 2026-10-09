-- ROLLBACK for 20261010090000_blog_ai_followups + 20261009180000_blog_ai_drafts (BLOG only).
-- NOT a migration. Run manually only after separate approval, and only if the AI drafting feature must be removed.
-- Restores blog_release exactly as in 20261003174612 and removes the AI tables/column. Existing articles are kept.
-- Stops (changes nothing) if an AI draft that is not yet published still exists, because removing the
-- approval guard would make such a draft publishable without approval. Handle those drafts first.
begin;

do $precheck$
begin
  if exists (select 1 from public.blog_ai_drafts d join public.blog_posts p on p.id = d.post_id
             where p.state <> 'published' or p.editing_revision_id is not null or p.scheduled_revision_id is not null) then
    raise exception 'BLOG_AI_ROLLBACK: unpublished or edited AI drafts exist; review them before rolling back';
  end if;
end;
$precheck$;

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

alter table public.blog_publication_events drop column if exists ai_approval_id;
-- The follow-up tables may be absent if only the first migration was applied.
drop table if exists public.blog_ai_runs, public.blog_ai_manual_sources, public.blog_post_derivatives;
drop table public.blog_ai_approvals, public.blog_ai_drafts, public.blog_topics, public.blog_source_documents, public.blog_source_urls;
drop function public.blog_ai_approve(uuid,bigint,text,text,timestamptz);
drop function public.blog_ai_current_approval(uuid);
drop function public.blog_ai_approvals_append_only();

-- Categories: remove the three added ones only if no revision uses them; restore the DATA LAB name.
delete from public.blog_categories c where c.slug in ('stadium-charm','stadium-basics','characters')
  and not exists (select 1 from public.blog_post_revisions r where r.category_id = c.id);
update public.blog_categories set name = 'DATA LAB' where slug = 'data-lab';

commit;
