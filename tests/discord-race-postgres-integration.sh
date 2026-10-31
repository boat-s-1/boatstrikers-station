#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
psql -v ON_ERROR_STOP=1 -q -f supabase/migrations/20261031004500_discord_race_thread_deliveries.sql
psql -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.bs_discord_race_thread_deliveries'::regclass) THEN RAISE EXCEPTION 'RLS disabled'; END IF;
  IF has_table_privilege('anon','public.bs_discord_race_thread_deliveries','SELECT') OR has_table_privilege('authenticated','public.bs_discord_race_thread_deliveries','INSERT') THEN RAISE EXCEPTION 'table grants exposed'; END IF;
  IF has_function_privilege('anon','public.bs_claim_discord_race_delivery(date,text,integer,text)','EXECUTE') OR has_function_privilege('authenticated','public.bs_claim_discord_race_delivery(date,text,integer,text)','EXECUTE') THEN RAISE EXCEPTION 'RPC exposed'; END IF;
  IF NOT has_function_privilege('service_role','public.bs_claim_discord_race_delivery(date,text,integer,text)','EXECUTE') THEN RAISE EXCEPTION 'service_role denied'; END IF;
END $$;
SQL
# Two independent PostgreSQL connections race to claim one delivery.
psql -v ON_ERROR_STOP=1 -Atc "select public.bs_claim_discord_race_delivery('2099-01-01','99',1,'thread')" > /tmp/discord-claim-a &
a=$!
psql -v ON_ERROR_STOP=1 -Atc "select public.bs_claim_discord_race_delivery('2099-01-01','99',1,'thread')" > /tmp/discord-claim-b &
b=$!
wait "$a"; wait "$b"
claims="$(cat /tmp/discord-claim-a /tmp/discord-claim-b | sort | tr '\n' ' ')"
test "$claims" = "f t " || { echo "Expected exactly one successful concurrent claim; got: $claims"; exit 1; }
test "$(psql -Atc "select count(*)||':'||max(attempt_count)||':'||max(state) from public.bs_discord_race_thread_deliveries where race_date='2099-01-01' and course_code='99' and race_no=1 and message_key='thread'")" = "1:1:sending"
psql -v ON_ERROR_STOP=1 -q -c "update public.bs_discord_race_thread_deliveries set state='unknown' where race_date='2099-01-01' and course_code='99' and race_no=1 and message_key='thread'"
test "$(psql -Atc "select public.bs_claim_discord_race_delivery('2099-01-01','99',1,'thread')")" = "f"
test "$(psql -Atc "select attempt_count from public.bs_discord_race_thread_deliveries where race_date='2099-01-01' and course_code='99' and race_no=1 and message_key='thread'")" = "1"
echo "PASS: isolated PostgreSQL grants, two-connection atomic claim, persistence, unknown-state lockout"
