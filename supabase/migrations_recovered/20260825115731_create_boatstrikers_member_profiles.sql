create table if not exists public.bs_member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  plan text not null default 'beta_premium' check (plan in ('free','beta_premium','plus','premium')),
  membership_status text not null default 'active' check (membership_status in ('active','inactive','cancelled','expired')),
  beta_member boolean not null default true,
  beta_started_at timestamptz not null default now(),
  premium_until timestamptz,
  line_user_id text,
  line_linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bs_member_profiles enable row level security;

drop policy if exists "members can read own profile" on public.bs_member_profiles;
create policy "members can read own profile"
on public.bs_member_profiles for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "members can update own basic profile" on public.bs_member_profiles;
create policy "members can update own basic profile"
on public.bs_member_profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_boatstrikers_member_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bs_member_profiles (user_id, email, display_name, plan, membership_status, beta_member)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'display_name','')), ''),
    'beta_premium',
    'active',
    true
  )
  on conflict (user_id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_boatstrikers_member_signup on auth.users;
create trigger on_boatstrikers_member_signup
after insert on auth.users
for each row execute function public.handle_boatstrikers_member_signup();

create or replace function public.touch_bs_member_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_bs_member_profiles_updated_at on public.bs_member_profiles;
create trigger touch_bs_member_profiles_updated_at
before update on public.bs_member_profiles
for each row execute function public.touch_bs_member_profiles_updated_at();

create index if not exists bs_member_profiles_plan_idx on public.bs_member_profiles(plan);
create index if not exists bs_member_profiles_status_idx on public.bs_member_profiles(membership_status);
create index if not exists bs_member_profiles_line_user_idx on public.bs_member_profiles(line_user_id) where line_user_id is not null;