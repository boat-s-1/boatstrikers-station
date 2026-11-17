-- Must run ONLY after CI's clock-rewritten /tmp candidate is installed.
-- Exercises the actual active-path mapper, stub HTTP and stub atomic RPC.
DO $$
DECLARE response jsonb;
BEGIN
 response:=public.bs_sync_openapi_today_atomic_candidate();
 IF response->>'fixture' IS DISTINCT FROM 'true' THEN
  RAISE EXCEPTION 'midday Cron active path did not reach atomic RPC: %',response;
 END IF;
 RAISE NOTICE 'CRON_FIXTURE_BRANCH=ACTIVE_PAYLOAD_VALIDATED';
END $$;
