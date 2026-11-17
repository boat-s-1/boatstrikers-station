-- Verify actual execution privileges, not just display them.
-- Only the service role can invoke the candidate atomic writer.
DO $t$
DECLARE sig text:='public.bs_apply_openapi_atomic_candidate(date,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,timestamptz)';
BEGIN
 IF NOT has_function_privilege('service_role',sig,'EXECUTE') THEN
   RAISE EXCEPTION 'service_role cannot execute atomic candidate';
 END IF;
 IF has_function_privilege('anon',sig,'EXECUTE')
    OR has_function_privilege('authenticated',sig,'EXECUTE')
    OR has_function_privilege('public',sig,'EXECUTE') THEN
   RAISE EXCEPTION 'atomic candidate is executable by public/anon/authenticated';
 END IF;
 RAISE NOTICE 'Atomic candidate privileges PASS: service_role only';
END $t$;
