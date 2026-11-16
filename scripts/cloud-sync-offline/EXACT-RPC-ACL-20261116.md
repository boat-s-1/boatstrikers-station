# Exact function ACL verification — 2026-11-16

Production read-only catalog check, no RPC execution.

| Function | Explicit ACL | PUBLIC EXECUTE |
|---|---|---|
| bs_apply_openapi_bootstrap | postgres, service_role | no |
| bs_record_first_seen | PUBLIC, postgres, anon, authenticated, service_role | yes |
| evaluate_ichika_escape_surge_alerts | PUBLIC, postgres, anon, authenticated, service_role | yes |

`bs_apply_openapi_bootstrap` is SECURITY DEFINER and has no general-public execution grant. The other two are SECURITY INVOKER; they can be invoked by general roles at SQL permission level, but their write statements remain subject to caller privileges/RLS. Actual HTTP/PostgREST exposure has **not** been verified; catalog permissions are not equivalent to a successful HTTP call.

## Suggested safe cloud writer boundary
- Run archive acquisition and offline six-boat/batch validation without privileged DB credentials.
- Only after validation, a server-side isolated writer can call `bs_apply_openapi_bootstrap` using a secret service credential; do not expose service keys to frontend, logs, PR, or downloaded archives.
- Require exact date and venue allowlist, natural-key uniqueness, complete 6 boats, valid numeric ranges, expected event/entry counts and replay idempotency before enabling production writes.
- Do not backdate `api_synced_at` as if a historical archive was captured pre-race; store real ingestion timestamp and label historical provenance.
- Maintain production write HOLD until a faithful isolated schema exists and tests pass.

## Read-only ACL SQL
```sql
SELECT p.proname,p.proacl::text AS explicit_acl,
 EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
        WHERE x.grantee=0 AND x.privilege_type='EXECUTE') AS public_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
AND p.proname IN ('bs_apply_openapi_bootstrap',
                 'bs_record_first_seen','evaluate_ichika_escape_surge_alerts')
ORDER BY p.proname;
```
