create table if not exists public.bs_member_feature_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
  usage_date date not null default ((timezone('Asia/Tokyo', now()))::date),
  usage_count integer not null default 0 check (usage_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature_key, usage_date),
  check (char_length(feature_key) between 1 and 80)
);

alter table public.bs_member_feature_usage_daily enable row level security;
revoke all on table public.bs_member_feature_usage_daily from anon, authenticated;
grant select, insert, update, delete on table public.bs_member_feature_usage_daily to service_role;

create or replace function public.bs_try_consume_member_feature(
  p_user_id uuid,
  p_feature_key text,
  p_usage_date date,
  p_limit integer
)
returns table(allowed boolean, usage_count integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_user_id is null or p_feature_key is null or char_length(p_feature_key) < 1 or char_length(p_feature_key) > 80 then
    raise exception 'invalid feature usage input';
  end if;
  if p_limit is null or p_limit <= 0 then
    return query select false, 0, 0;
    return;
  end if;

  insert into public.bs_member_feature_usage_daily(user_id, feature_key, usage_date, usage_count, updated_at)
  values (p_user_id, p_feature_key, p_usage_date, 1, now())
  on conflict (user_id, feature_key, usage_date)
  do update set usage_count = bs_member_feature_usage_daily.usage_count + 1, updated_at = now()
  where bs_member_feature_usage_daily.usage_count < p_limit
  returning bs_member_feature_usage_daily.usage_count into v_count;

  if v_count is null then
    select u.usage_count into v_count
    from public.bs_member_feature_usage_daily u
    where u.user_id = p_user_id and u.feature_key = p_feature_key and u.usage_date = p_usage_date;
    return query select false, coalesce(v_count, p_limit), 0;
    return;
  end if;

  return query select true, v_count, greatest(p_limit - v_count, 0);
end;
$$;

create or replace function public.bs_refund_member_feature(
  p_user_id uuid,
  p_feature_key text,
  p_usage_date date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.bs_member_feature_usage_daily
  set usage_count = greatest(usage_count - 1, 0), updated_at = now()
  where user_id = p_user_id and feature_key = p_feature_key and usage_date = p_usage_date
  returning usage_count into v_count;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.bs_try_consume_member_feature(uuid,text,date,integer) from public, anon, authenticated;
revoke all on function public.bs_refund_member_feature(uuid,text,date) from public, anon, authenticated;
grant execute on function public.bs_try_consume_member_feature(uuid,text,date,integer) to service_role;
grant execute on function public.bs_refund_member_feature(uuid,text,date) to service_role;
