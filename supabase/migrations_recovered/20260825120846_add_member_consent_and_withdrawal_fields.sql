alter table public.bs_member_profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists withdrawn_at timestamptz;

create or replace function public.handle_boatstrikers_member_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bs_member_profiles (
    user_id, email, display_name, plan, membership_status, beta_member,
    terms_accepted_at, privacy_accepted_at
  )
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'display_name','')), ''),
    'beta_premium',
    'active',
    true,
    case when coalesce(new.raw_user_meta_data->>'terms_accepted','false') = 'true' then now() else null end,
    case when coalesce(new.raw_user_meta_data->>'privacy_accepted','false') = 'true' then now() else null end
  )
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.bs_member_profiles.display_name),
        terms_accepted_at = coalesce(public.bs_member_profiles.terms_accepted_at, excluded.terms_accepted_at),
        privacy_accepted_at = coalesce(public.bs_member_profiles.privacy_accepted_at, excluded.privacy_accepted_at),
        updated_at = now();
  return new;
end;
$$;