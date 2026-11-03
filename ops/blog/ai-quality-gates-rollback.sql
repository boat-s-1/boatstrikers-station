-- Rollback of supabase/migrations/20261103120000_blog_ai_quality_gates.sql (PHASE 1). NOT a migration.
-- Run only after approval, on the project the migration was applied to, in one transaction.
--
-- What it does:
--   1. stops automatic approval (manual mode, auto-publish off) — effective immediately for pending releases;
--   2. restores blog_ai_current_approval exactly as in 20261009180000_blog_ai_drafts.sql;
--   3. removes the approver_kind / gate_result_id columns from blog_ai_approvals (only when no system approval exists);
--   4. drops the two new functions;
--   5. moves blog_ai_settings and blog_ai_gate_results, with their rows, to the private schema blog_ai_gates_archive
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

alter table public.blog_ai_approvals drop constraint blog_ai_approvals_system_has_gate;
alter table public.blog_ai_approvals drop column gate_result_id;
alter table public.blog_ai_approvals drop column approver_kind;

drop function public.blog_ai_system_approve(uuid, bigint, uuid);
drop function public.blog_ai_record_gate_result(uuid, bigint, integer, text, jsonb, text, jsonb);

create schema blog_ai_gates_archive;
revoke all on schema blog_ai_gates_archive from public, anon, authenticated;
grant usage on schema blog_ai_gates_archive to service_role;
alter table public.blog_ai_gate_results set schema blog_ai_gates_archive;
alter table public.blog_ai_settings set schema blog_ai_gates_archive;
revoke all on all tables in schema blog_ai_gates_archive from public, anon, authenticated;
grant select on all tables in schema blog_ai_gates_archive to service_role;

commit;
