create table if not exists public.bs_member_favorite_racers (
  user_id uuid not null references auth.users(id) on delete cascade,
  racer_registration_no text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, racer_registration_no),
  constraint bs_member_favorite_racers_registration_no_check
    check (racer_registration_no ~ '^[0-9]{1,5}$')
);

create index if not exists bs_member_favorite_racers_racer_idx
  on public.bs_member_favorite_racers (racer_registration_no);

alter table public.bs_member_favorite_racers enable row level security;

create policy "members can read own favorite racers"
  on public.bs_member_favorite_racers
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "members can add own favorite racers"
  on public.bs_member_favorite_racers
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "members can remove own favorite racers"
  on public.bs_member_favorite_racers
  for delete
  to authenticated
  using (auth.uid() = user_id);
