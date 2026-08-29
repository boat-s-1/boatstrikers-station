create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create table if not exists public.hatsune_scheduler_config (
  id text primary key,
  token text not null default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hatsune_scheduler_config enable row level security;
revoke all on table public.hatsune_scheduler_config from anon, authenticated;

insert into public.hatsune_scheduler_config (id)
values ('primary')
on conflict (id) do nothing;

-- 再適用時に同名ジョブが重複しないよう削除
select cron.unschedule(jobid)
from cron.job
where jobname in (
  'hatsune-news-1000-jst',
  'hatsune-news-1400-jst',
  'hatsune-news-2200-jst'
);

select cron.schedule(
  'hatsune-news-1000-jst',
  '0 1 * * *',
  $job$
    select net.http_get(
      url := 'https://www.boat-strike.online/api/cron/hatsune-news-pipeline',
      headers := jsonb_build_object(
        'X-Hatsune-Scheduler-Token',
        (select token from public.hatsune_scheduler_config where id = 'primary')
      ),
      timeout_milliseconds := 120000
    );
  $job$
);

select cron.schedule(
  'hatsune-news-1400-jst',
  '0 5 * * *',
  $job$
    select net.http_get(
      url := 'https://www.boat-strike.online/api/cron/hatsune-news-pipeline',
      headers := jsonb_build_object(
        'X-Hatsune-Scheduler-Token',
        (select token from public.hatsune_scheduler_config where id = 'primary')
      ),
      timeout_milliseconds := 120000
    );
  $job$
);

select cron.schedule(
  'hatsune-news-2200-jst',
  '0 13 * * *',
  $job$
    select net.http_get(
      url := 'https://www.boat-strike.online/api/cron/hatsune-news-pipeline',
      headers := jsonb_build_object(
        'X-Hatsune-Scheduler-Token',
        (select token from public.hatsune_scheduler_config where id = 'primary')
      ),
      timeout_milliseconds := 120000
    );
  $job$
);
