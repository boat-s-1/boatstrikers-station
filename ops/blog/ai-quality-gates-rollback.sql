-- Rollback of supabase/migrations/20261103120000_blog_ai_quality_gates.sql (PHASE 1). NOT a migration.
-- Run only after approval, on the project the migration was applied to, in one transaction.
--
-- What it does:
--   1. stops automatic approval (manual mode, auto-publish off) — effective immediately for pending releases;
--   2. restores blog_ai_current_approval exactly as in 20261009180000_blog_ai_drafts.sql;
--   3. removes the approver_kind / gate_result_id columns from blog_ai_approvals (only when no system approval exists);
--   4. restores blog_publish_due exactly as in 20261002141712, drops the publication guard trigger and the new functions;
--   5. moves blog_ai_settings, blog_ai_gate_results, blog_ai_auto_publications and blog_ai_jobs, with their rows, to the private schema blog_ai_gates_archive
--      (history is kept, nothing is deleted).
-- It refuses (and changes nothing) when a system approval exists, when the archive schema already exists, or when the
-- migration is not applied. blog_release is not touched by the migration and is not touched here.
begin;

do $check$
begin
  if to_regclass('public.blog_ai_settings') is null or to_regclass('public.blog_ai_gate_results') is null then
    raise exception 'BLOG_AI_GATES_ROLLBACK: the migration is not applied here';
  end if;
  if exists (select 1 from public.blog_ai_approvals where approver_kind = 'system') then
    raise exception 'BLOG_AI_GATES_ROLLBACK: system approvals exist; review and archive them before rolling back';
  end if;
  if to_regnamespace('blog_ai_gates_archive') is not null then
    raise exception 'BLOG_AI_GATES_ROLLBACK: schema blog_ai_gates_archive already exists';
  end if;
end;
$check$;

update public.blog_ai_settings set approval_mode = 'manual', auto_publish_enabled = false, generation_enabled = false, updated_at = now(), updated_by = 'rollback';

create or replace function public.blog_ai_current_approval(p_post_id uuid) returns uuid
language sql stable security invoker set search_path = '' as $$
  select a.id from public.blog_ai_approvals a join public.blog_posts p on p.id = a.post_id
  where a.post_id = p_post_id and a.revision_id = p.editing_revision_id and a.edit_version = p.edit_version
  order by a.created_at desc limit 1;
$$;
revoke all on function public.blog_ai_current_approval(uuid) from public, anon, authenticated;
grant execute on function public.blog_ai_current_approval(uuid) to service_role;

-- Archive the tables that reference blog_ai_approvals.gate_result_id first (system approvals are refused above).
create schema blog_ai_gates_archive;
alter table public.blog_ai_auto_publications set schema blog_ai_gates_archive;
alter table public.blog_ai_jobs set schema blog_ai_gates_archive;
alter table public.blog_ai_approvals drop constraint blog_ai_approvals_system_has_gate;
alter table public.blog_ai_approvals drop column gate_result_id;
alter table public.blog_ai_approvals drop column approver_kind;

drop trigger blog_ai_guard_publication on public.blog_posts;
create or replace function public.blog_publish_due(p_limit integer default 20) returns jsonb
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
revoke all on function public.blog_publish_due(integer) from public, anon, authenticated;
grant execute on function public.blog_publish_due(integer) to service_role;

drop function public.blog_ai_auto_publish(uuid, bigint, uuid);
drop function public.blog_ai_job_claim(date, text, text, integer);
drop function public.blog_ai_job_transition(date, text, text, jsonb);
drop function public.blog_ai_job_release(date, text);
drop function public.blog_ai_job_transition_allowed(text, text);
drop function public.blog_ai_guard_publication();
drop function public.blog_ai_release_allowed(uuid, uuid);
drop function public.blog_ai_jst_now();
drop function public.blog_ai_system_approve(uuid, bigint, uuid);
drop function public.blog_ai_record_gate_result(uuid, bigint, integer, text, jsonb, text, jsonb);

revoke all on schema blog_ai_gates_archive from public, anon, authenticated;
grant usage on schema blog_ai_gates_archive to service_role;
alter table public.blog_ai_gate_results set schema blog_ai_gates_archive;
alter table public.blog_ai_settings set schema blog_ai_gates_archive;
revoke all on all tables in schema blog_ai_gates_archive from public, anon, authenticated;
grant select on all tables in schema blog_ai_gates_archive to service_role;

commit;
