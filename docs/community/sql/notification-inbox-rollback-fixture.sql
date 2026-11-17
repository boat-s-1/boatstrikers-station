-- REVIEW ONLY — DO NOT APPLY TO PRODUCTION.
-- Prototype for a future isolated Postgres/Supabase integration test.
-- This script is deliberately wrapped in a transaction with ROLLBACK.
BEGIN;
CREATE TABLE IF NOT EXISTS public.bs_notification_inbox_fixture (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('thread_reply','prediction_published','favorite_racer_update','service_notice')),
  dedupe_key text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  safe_summary text CHECK (char_length(safe_summary) <= 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  deleted_at timestamptz,
  UNIQUE (recipient_user_id,dedupe_key)
);
ALTER TABLE public.bs_notification_inbox_fixture ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bs_notification_inbox_fixture FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.bs_notification_inbox_fixture TO authenticated;
CREATE POLICY inbox_fixture_read_own ON public.bs_notification_inbox_fixture
  FOR SELECT TO authenticated USING ((select auth.uid()) = recipient_user_id);
-- No INSERT/UPDATE/DELETE for client roles. Only trusted server code may enqueue
-- and mark read; application API must verify the signed-in user's identity.
SELECT
  has_table_privilege('anon','public.bs_notification_inbox_fixture','SELECT') AS anon_select,
  has_table_privilege('authenticated','public.bs_notification_inbox_fixture','SELECT') AS member_select,
  has_table_privilege('authenticated','public.bs_notification_inbox_fixture','INSERT') AS member_insert,
  has_table_privilege('authenticated','public.bs_notification_inbox_fixture','UPDATE') AS member_update,
  has_table_privilege('authenticated','public.bs_notification_inbox_fixture','DELETE') AS member_delete,
  has_table_privilege('authenticated','public.bs_notification_inbox_fixture','TRUNCATE') AS member_truncate;
ROLLBACK;
