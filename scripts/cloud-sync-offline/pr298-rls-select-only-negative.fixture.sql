-- PR298 disposable PostgreSQL CI ONLY. Never run on production.
-- Exercise RLS semantics of broad grants + SELECT-only policies using a
-- purpose-built table, not production data or production credentials.
BEGIN;
CREATE TABLE public.pr298_rls_write_probe (id integer PRIMARY KEY, note text);
ALTER TABLE public.pr298_rls_write_probe ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.pr298_rls_write_probe TO anon, authenticated, service_role;
CREATE POLICY pr298_probe_read ON public.pr298_rls_write_probe
  FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.pr298_rls_write_probe VALUES (1,'seed');
SET LOCAL ROLE anon;
DO $probe$
BEGIN
  BEGIN
    INSERT INTO public.pr298_rls_write_probe VALUES (2,'forbidden');
    RAISE EXCEPTION 'PR298_FAIL: anon INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PR298_PASS: anon INSERT rejected by RLS';
  END;
  IF (SELECT count(*) FROM public.pr298_rls_write_probe) <> 1 THEN
    RAISE EXCEPTION 'PR298_FAIL: anon SELECT unexpected count';
  END IF;
  IF (SELECT count(*) FROM public.pr298_rls_write_probe WHERE id=2) <> 0 THEN
    RAISE EXCEPTION 'PR298_FAIL: forbidden row visible';
  END IF;
END
$probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $probe$
BEGIN
  BEGIN
    INSERT INTO public.pr298_rls_write_probe VALUES (3,'forbidden');
    RAISE EXCEPTION 'PR298_FAIL: authenticated INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PR298_PASS: authenticated INSERT rejected by RLS';
  END;
END
$probe$;
RESET ROLE;
-- UPDATE/DELETE also require a write policy, even with broad table grants.
SET LOCAL ROLE anon;
DO $probe$
BEGIN
  BEGIN
    UPDATE public.pr298_rls_write_probe SET note='forbidden-update' WHERE id=1;
    IF FOUND THEN
      RAISE EXCEPTION 'PR298_FAIL: anon UPDATE changed a row';
    END IF;
    RAISE NOTICE 'PR298_PASS: anon UPDATE affected zero rows under RLS';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PR298_PASS: anon UPDATE rejected by RLS';
  END;
  BEGIN
    DELETE FROM public.pr298_rls_write_probe WHERE id=1;
    IF FOUND THEN
      RAISE EXCEPTION 'PR298_FAIL: anon DELETE changed a row';
    END IF;
    RAISE NOTICE 'PR298_PASS: anon DELETE affected zero rows under RLS';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PR298_PASS: anon DELETE rejected by RLS';
  END;
END
$probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $probe$
BEGIN
  BEGIN
    UPDATE public.pr298_rls_write_probe SET note='forbidden-update' WHERE id=1;
    IF FOUND THEN
      RAISE EXCEPTION 'PR298_FAIL: authenticated UPDATE changed a row';
    END IF;
    RAISE NOTICE 'PR298_PASS: authenticated UPDATE affected zero rows under RLS';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PR298_PASS: authenticated UPDATE rejected by RLS';
  END;
  BEGIN
    DELETE FROM public.pr298_rls_write_probe WHERE id=1;
    IF FOUND THEN
      RAISE EXCEPTION 'PR298_FAIL: authenticated DELETE changed a row';
    END IF;
    RAISE NOTICE 'PR298_PASS: authenticated DELETE affected zero rows under RLS';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PR298_PASS: authenticated DELETE rejected by RLS';
  END;
END
$probe$;
RESET ROLE;
DO $probe$
BEGIN
  IF (SELECT count(*) FROM public.pr298_rls_write_probe WHERE id=1 AND note='seed') <> 1 THEN
    RAISE EXCEPTION 'PR298_FAIL: protected seed row was modified or deleted';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pr298_rls_write_probe WHERE id IN (2,3)) THEN
    RAISE EXCEPTION 'PR298_FAIL: RLS-denied rows persisted';
  END IF;
  RAISE NOTICE 'PR298_PASS: no unauthorized rows persisted';
END
$probe$;
ROLLBACK;
