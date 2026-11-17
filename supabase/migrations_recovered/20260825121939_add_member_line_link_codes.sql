create table if not exists public.bs_member_line_link_codes (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  line_user_id text,
  created_at timestamptz not null default now()
);

create index if not exists bs_member_line_link_codes_user_id_idx on public.bs_member_line_link_codes(user_id);
create index if not exists bs_member_line_link_codes_code_idx on public.bs_member_line_link_codes(code);

alter table public.bs_member_line_link_codes enable row level security;

drop policy if exists "members can view own line codes" on public.bs_member_line_link_codes;
create policy "members can view own line codes"
on public.bs_member_line_link_codes
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "members can create own line codes" on public.bs_member_line_link_codes;
create policy "members can create own line codes"
on public.bs_member_line_link_codes
for insert
to authenticated
with check (auth.uid() = user_id);
