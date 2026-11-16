-- CI-only end-to-end: mocked HTTP -> real atomic candidate -> four stubbed phase writers.
-- Requires noon-JST caller and the real atomic candidate to be installed.
DO $$
DECLARE before_count bigint; after_count bigint; response jsonb; phases text[];
BEGIN
 SELECT count(*) INTO before_count FROM public.atomic_fixture_writes;
 response:=public.bs_sync_openapi_today_atomic_candidate();
 IF response->>'event_count' IS DISTINCT FROM '1'
    OR response->>'entry_count' IS DISTINCT FROM '6' THEN
  RAISE EXCEPTION 'real atomic RPC did not receive 1 race/6 boats: %',response;
 END IF;
 SELECT count(*) INTO after_count FROM public.atomic_fixture_writes;
 IF after_count-before_count <> 4 THEN
  RAISE EXCEPTION 'expected four transactional phases, got %',after_count-before_count;
 END IF;
 SELECT array_agg(phase ORDER BY ctid) INTO phases
 FROM (SELECT ctid,phase FROM public.atomic_fixture_writes
       ORDER BY ctid DESC LIMIT 4) last4;
 IF phases IS DISTINCT FROM ARRAY['bootstrap','preview_entries','preview_events','results']::text[] THEN
  RAISE EXCEPTION 'phase order mismatch: %',phases;
 END IF;
 RAISE NOTICE 'CRON_REAL_ATOMIC_RPC=PASS (mock HTTP, real validation, 4 stub phase writers)';
END $$;
