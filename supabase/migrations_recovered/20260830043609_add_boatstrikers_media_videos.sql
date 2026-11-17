create table if not exists public.bs_media_videos (
  video_id text primary key,
  place_code text not null,
  place_name text not null,
  channel_id text not null,
  channel_url text not null,
  title text not null,
  video_url text not null,
  thumbnail_url text,
  published_at timestamptz,
  women_related boolean not null default false,
  official_description text,
  collected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bs_media_videos_published_at_idx on public.bs_media_videos (published_at desc);
create index if not exists bs_media_videos_place_code_idx on public.bs_media_videos (place_code, published_at desc);
create index if not exists bs_media_videos_women_idx on public.bs_media_videos (women_related, published_at desc);

alter table public.bs_media_videos enable row level security;

drop policy if exists "Public can read media videos" on public.bs_media_videos;
create policy "Public can read media videos"
on public.bs_media_videos
for select
to anon, authenticated
using (true);

grant select on public.bs_media_videos to anon, authenticated;