# Production RPC execution permissions — read-only check 2026-11-16

Used `has_function_privilege` and `has_table_privilege` in production (no calls to the functions themselves).

| Function | SECURITY DEFINER | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE |
|---|---|---|---|---|
| bs_apply_openapi_bootstrap | yes | no | no | yes |
| bs_capture_theory_recommendation | yes | no | no | yes |
| bs_settle_theory_recommendation | yes | no | no | yes |
| bs_record_first_seen | no | yes | yes | yes |
| evaluate_ichika_escape_surge_alerts | no | yes | yes | yes |

All five are owned by `postgres`. For the six scoped tables, `has_table_privilege` returned true for anon SELECT/INSERT/UPDATE, authenticated INSERT, and service_role INSERT. **This is not proof of write access**: all six tables have RLS enabled, the first three have SELECT-only policies and the other three have no policies. Thus direct anon/authenticated inserts should be blocked by RLS absent bypass or special role context. A network-level negative test has not been executed.

## Security interpretation
- Bootstrap RPC is not directly callable by anon/authenticated based on catalog privileges.
- The two SECURITY INVOKER functions with public EXECUTE may still be denied writes by RLS; do not assume exploitable access without a controlled negative test.
- A server-side cloud writer should hold service credentials in a secret store only, never expose them to browser/client or repository.
- Need to verify actual PostgREST exposed schemas, function grants and production endpoint behavior without invoking a write-capable endpoint.
- No GRANT/REVOKE or production changes have been made.

## SQL
```sql
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args,
p.prosecdef AS security_definer,pg_get_userbyid(p.proowner) AS owner,
has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_exec,
has_function_privilege('service_role',p.oid,'EXECUTE') AS service_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
('bs_apply_openapi_bootstrap','bs_capture_theory_recommendation',
'bs_settle_theory_recommendation','bs_record_first_seen',
'evaluate_ichika_escape_surge_alerts')
ORDER BY p.proname;
```
