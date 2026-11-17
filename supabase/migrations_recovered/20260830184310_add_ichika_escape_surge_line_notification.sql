alter table public.bs_member_notification_preferences add column if not exists ichika_escape_surge boolean not null default false;
alter table public.bs_ichika_escape_surge_alerts add column if not exists notified boolean not null default false;
alter table public.bs_ichika_escape_surge_alerts add column if not exists notified_at timestamptz;
create index if not exists idx_bs_ichika_escape_surge_alerts_pending on public.bs_ichika_escape_surge_alerts (race_date, notified, detected_at);