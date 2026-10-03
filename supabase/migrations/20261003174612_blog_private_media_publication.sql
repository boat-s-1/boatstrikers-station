-- BLOG only. No Storage public bucket or bearer URL is created.
create function public.blog_media_is_published(p_media_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists (
  select 1 from public.blog_posts p join public.blog_post_revisions r on r.id=p.published_revision_id and r.post_id=p.id
  where p.state='published' and p.first_published_at<=now() and r.state='sealed'
  and (nullif(r.cover->>'media_id','')::uuid=p_media_id or nullif(r.seo->>'og_media_id','')::uuid=p_media_id
   or exists(select 1 from public.blog_blocks b where b.revision_id=r.id and b.type='IMAGE' and nullif(b.data->>'media_id','')::uuid=p_media_id))
 );
$$;
revoke all on function public.blog_media_is_published(uuid) from public;
grant execute on function public.blog_media_is_published(uuid) to anon,authenticated,service_role;
drop policy blog_media_public_read on public.blog_media;
create policy blog_media_public_read on public.blog_media for select to anon,authenticated
 using (status='public' and public.blog_media_is_published(id));

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
