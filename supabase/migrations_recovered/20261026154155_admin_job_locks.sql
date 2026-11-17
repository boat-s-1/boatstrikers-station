-- 提案（未適用）：管理者 API の多重起動を、複数のサーバーレスインスタンスをまたいで防ぐロック。
-- supabase/migrations ではなく proposals に置いている。適用は別途承認のうえ、手動で行う。
-- 適用前でも lib/adminJobLock.js はインスタンス内の防止だけで動く（関数が無いことを検出して切り替える）。

create table if not exists public.bs_admin_job_locks (
  job text primary key,
  holder text not null,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.bs_admin_job_locks enable row level security;
-- ポリシーは作らない（anon / authenticated からは読めず書けない。service role だけが使う）

-- 取得：期限切れか未登録のときだけ自分のものにする。1文の INSERT ... ON CONFLICT なので同時に呼ばれても1つだけが true
create or replace function public.bs_admin_try_lock(p_job text, p_holder text, p_ttl_seconds integer)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  with claimed as (
    insert into public.bs_admin_job_locks as l (job, holder, locked_until, updated_at)
    values (p_job, p_holder, now() + make_interval(secs => greatest(1, least(p_ttl_seconds, 3600))), now())
    on conflict (job) do update
      set holder = excluded.holder, locked_until = excluded.locked_until, updated_at = now()
      where l.locked_until < now()
    returning 1
  )
  select exists (select 1 from claimed);
$$;

-- 解放：自分が持っているときだけ。cooldown 秒だけ次の取得を待たせる（0 なら即解放）
create or replace function public.bs_admin_release_lock(p_job text, p_holder text, p_cooldown_seconds integer default 0)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.bs_admin_job_locks
     set locked_until = now() + make_interval(secs => greatest(0, least(p_cooldown_seconds, 3600))), updated_at = now()
   where job = p_job and holder = p_holder;
$$;

revoke all on table public.bs_admin_job_locks from public, anon, authenticated;
revoke all on function public.bs_admin_try_lock(text, text, integer) from public, anon, authenticated;
revoke all on function public.bs_admin_release_lock(text, text, integer) from public, anon, authenticated;
grant execute on function public.bs_admin_try_lock(text, text, integer) to service_role;
grant execute on function public.bs_admin_release_lock(text, text, integer) to service_role;

-- 戻し方：
-- drop function if exists public.bs_admin_release_lock(text, text, integer);
-- drop function if exists public.bs_admin_try_lock(text, text, integer);
-- drop table if exists public.bs_admin_job_locks;
