-- Phase 2: enable RLS on the 12 exposed tables flagged by Security Advisor.
-- Public-facing read models keep SELECT-only access; internal operational/training tables become service-role/internal only.

-- 1) Enable RLS everywhere flagged.
alter table public.bs_live_source_sync_logs enable row level security;
alter table public.ai_v2_training_rows enable row level security;
alter table public.ai_v2_models enable row level security;
alter table public.ai_v2_trifecta_predictions enable row level security;
alter table public.ai_v2_daily_rankings enable row level security;
alter table public.ai_v2_model_evaluations enable row level security;
alter table public.ai_v2_model_slots enable row level security;
alter table public.bs_ai_predictions_legacy_archive enable row level security;
alter table public.ai_v2_predictions enable row level security;
alter table public.bs_ichika_hidden_escape_alerts enable row level security;
alter table public.bs_hatsune_box_alerts enable row level security;
alter table public.bs_hatsune_womens_inner_break_alerts enable row level security;

-- 2) Remove direct mutation rights from browser-facing roles on every flagged table.
revoke insert, update, delete, truncate, references, trigger on public.bs_live_source_sync_logs from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.ai_v2_training_rows from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.ai_v2_models from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.ai_v2_trifecta_predictions from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.ai_v2_daily_rankings from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.ai_v2_model_evaluations from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.ai_v2_model_slots from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.bs_ai_predictions_legacy_archive from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.ai_v2_predictions from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.bs_ichika_hidden_escape_alerts from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.bs_hatsune_box_alerts from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.bs_hatsune_womens_inner_break_alerts from anon, authenticated;

-- 3) Internal-only tables: no browser SELECT access.
revoke select on public.bs_live_source_sync_logs from anon, authenticated;
revoke select on public.ai_v2_training_rows from anon, authenticated;
revoke select on public.ai_v2_models from anon, authenticated;
revoke select on public.ai_v2_model_evaluations from anon, authenticated;
revoke select on public.ai_v2_model_slots from anon, authenticated;
revoke select on public.bs_ai_predictions_legacy_archive from anon, authenticated;

-- 4) Public read-only tables used to present predictions/rankings/alerts.
grant select on public.ai_v2_trifecta_predictions to anon, authenticated;
grant select on public.ai_v2_daily_rankings to anon, authenticated;
grant select on public.ai_v2_predictions to anon, authenticated;
grant select on public.bs_ichika_hidden_escape_alerts to anon, authenticated;
grant select on public.bs_hatsune_box_alerts to anon, authenticated;
grant select on public.bs_hatsune_womens_inner_break_alerts to anon, authenticated;

-- Idempotent policy creation.
drop policy if exists public_read_ai_v2_trifecta_predictions on public.ai_v2_trifecta_predictions;
create policy public_read_ai_v2_trifecta_predictions on public.ai_v2_trifecta_predictions
  for select to anon, authenticated using (true);

drop policy if exists public_read_ai_v2_daily_rankings on public.ai_v2_daily_rankings;
create policy public_read_ai_v2_daily_rankings on public.ai_v2_daily_rankings
  for select to anon, authenticated using (true);

drop policy if exists public_read_ai_v2_predictions on public.ai_v2_predictions;
create policy public_read_ai_v2_predictions on public.ai_v2_predictions
  for select to anon, authenticated using (true);

drop policy if exists public_read_bs_ichika_hidden_escape_alerts on public.bs_ichika_hidden_escape_alerts;
create policy public_read_bs_ichika_hidden_escape_alerts on public.bs_ichika_hidden_escape_alerts
  for select to anon, authenticated using (true);

drop policy if exists public_read_bs_hatsune_box_alerts on public.bs_hatsune_box_alerts;
create policy public_read_bs_hatsune_box_alerts on public.bs_hatsune_box_alerts
  for select to anon, authenticated using (true);

drop policy if exists public_read_bs_hatsune_womens_inner_break_alerts on public.bs_hatsune_womens_inner_break_alerts;
create policy public_read_bs_hatsune_womens_inner_break_alerts on public.bs_hatsune_womens_inner_break_alerts
  for select to anon, authenticated using (true);