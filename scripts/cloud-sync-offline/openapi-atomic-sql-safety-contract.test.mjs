import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const atomic = readFileSync(new URL('./openapi-atomic-ingest.candidate.sql',import.meta.url),'utf8');
const cron = readFileSync(new URL('./openapi-atomic-cron-caller.candidate.sql',import.meta.url),'utf8');
const bootstrap = readFileSync(new URL('../../supabase/migrations/20260923133500_add_openapi_bootstrap_rpc.sql',import.meta.url),'utf8');

test('atomic candidate is current JST date only and rejects stale captures',()=>{
 assert.match(atomic,/p_date\s*<>\s*\(now\(\) AT TIME ZONE 'Asia\/Tokyo'\)::date/);
 assert.match(atomic,/p_synced_at < now\(\) - interval '15 minutes'/);
 assert.match(atomic,/v_entries<>6\*v_events/);
});
test('atomic candidate validates per-race boat and racer identity',()=>{
 assert.match(atomic,/GROUP BY race_date,course_code,race_no,boat_no HAVING count\(\*\)<>1/);
 assert.match(atomic,/GROUP BY race_date,course_code,race_no,racer_registration_no HAVING count\(\*\)<>1/);
 assert.match(atomic,/OpenAPI persisted program incomplete: transaction rolled back/);
 assert.match(atomic,/pg_try_advisory_xact_lock/);
});
test('atomic candidate limits execution to service_role and is one transaction',()=>{
 assert.match(atomic,/^BEGIN;/m);
 assert.match(atomic,/^COMMIT;/m);
 assert.match(atomic,/REVOKE ALL ON FUNCTION public\.bs_apply_openapi_atomic_candidate\([\s\S]*?FROM PUBLIC,anon,authenticated/);
 assert.match(atomic,/GRANT EXECUTE ON FUNCTION public\.bs_apply_openapi_atomic_candidate\([\s\S]*?TO service_role/);
});
test('cron candidate requires validated programs and invokes one atomic RPC',()=>{
 assert.match(cron,/v_clock < time '07:00' OR v_clock > time '23:30'/);
 assert.match(cron,/invalid official OpenAPI program/);
 assert.match(cron,/RETURN public\.bs_apply_openapi_atomic_candidate\(/);
 assert.doesNotMatch(cron,/PERFORM public\.bs_apply_openapi_bootstrap/);
});
test('bootstrap inserts missing rows only and preserves pre-existing race data',()=>{
 assert.equal((bootstrap.match(/on conflict \(race_date, course_code, race_no(?:, boat_no)?\) do nothing;/g)||[]).length,2);
 assert.doesNotMatch(bootstrap,/ON CONFLICT[\s\S]{0,100}DO UPDATE/i);
 assert.match(bootstrap,/BOATRACE_OPEN_API_BOOTSTRAP/);
});

const readiness = readFileSync(new URL('./PR298-PRODUCTION-READONLY-READINESS.sql',import.meta.url),'utf8');

test('production readiness probe is read-only and checks persisted key/identity integrity',()=>{
 assert.match(readiness,/WITH days AS \(/);
 assert.match(readiness,/orphan_result_races/);
 assert.match(readiness,/events_without_six_entries/);
 assert.match(readiness,/count\(DISTINCT en\.boat_no\)<>6/);
 assert.match(readiness,/count\(DISTINCT en\.racer_registration_no\)<>6/);
 assert.match(readiness,/HOLD: no persisted events/);
 assert.match(readiness,/LOCAL-IDENTITY PASS ONLY/);
 assert.doesNotMatch(readiness,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO)\s+(?:INTO\s+|FROM\s+|TABLE\s+|FUNCTION\s+)?(?:public\.|cron\.|\w+\s*\()/i);
 assert.equal((readiness.match(/\bSELECT\s+p\.race_date/g)||[]).length,1);
});
