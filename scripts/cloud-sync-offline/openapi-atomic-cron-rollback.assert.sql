-- CI-only: mocked HTTP -> real atomic RPC -> four phase-writer stubs.
-- A failure in the final results phase must roll back earlier three writes.
DO $$
DECLARE before_count bigint; after_count bigint; caught boolean:=false; response jsonb;
BEGIN
 SELECT count(*) INTO before_count FROM public.atomic_fixture_writes;
 PERFORM set_config('bs_fixture.fail_results','yes',true);
 BEGIN
  PERFORM public.bs_sync_openapi_today_atomic_candidate();
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%fixture injected results failure%' THEN
   RAISE EXCEPTION 'unexpected rollback error: %',SQLERRM;
  END IF;
  caught:=true;
 END;
 PERFORM set_config('bs_fixture.fail_results','no',true);
 IF NOT caught THEN RAISE EXCEPTION 'injected final-phase failure was not raised'; END IF;
 SELECT count(*) INTO after_count FROM public.atomic_fixture_writes;
 IF after_count <> before_count THEN
  RAISE EXCEPTION 'partial writes survived rollback: before %, after %',before_count,after_count;
 END IF;
 response:=public.bs_sync_openapi_today_atomic_candidate();
 IF response->>'event_count' IS DISTINCT FROM '1' THEN
  RAISE EXCEPTION 'retry after rollback failed: %',response;
 END IF;
 SELECT count(*) INTO after_count FROM public.atomic_fixture_writes;
 IF after_count <> before_count+4 THEN
  RAISE EXCEPTION 'retry did not commit all four phases: before %, after %',before_count,after_count;
 END IF;
 RAISE NOTICE 'CRON_REAL_RPC_ROLLBACK=PASS (final phase failure rolls back all writes, retry commits four phases)';
END $$;
