alter table public.bs_member_profiles
  add column if not exists is_admin boolean not null default false;

update public.bs_member_profiles
set is_admin = true
where line_user_id is not null
  and is_admin = false;
