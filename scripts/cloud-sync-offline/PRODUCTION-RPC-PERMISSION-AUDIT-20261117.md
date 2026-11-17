# Production OpenAPI RPC permission audit — 2026-11-17

Scope: SELECT-only catalog inspection against production Supabase project `rzosrbkyniyedolhkgxo`. No RPC invocation, migrations, or data writes.

| Function | SECURITY DEFINER | Owner | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE |
|---|---|---|---|---|---|
| bs_apply_openapi_bootstrap | true | postgres | false | false | true |
| bs_apply_openapi_preview | true | postgres | false | false | true |
| bs_apply_openapi_preview_events | true | postgres | false | false | true |
| bs_sync_openapi_today | true | postgres | false | false | true |

All four functions have explicit ACL `{postgres=X/postgres,service_role=X/postgres}`. The three apply functions have `search_path=public`; the sync function has `search_path=public, extensions`. Privileges were checked using `has_function_privilege`, not inferred solely from ACL text.

## Implications
- Direct anonymous/authenticated invocation is blocked **at the database privilege layer** for these exact functions at audit time.
- SECURITY DEFINER functions execute with owner privileges, so route authentication, strict input validation, and trigger side effects remain critical.
- This does not verify the deployed Next.js route or guarantee transactional grouping across its separate RPC calls.
- No authorization is given to change function grants or invoke write RPCs.

## Reproducible read-only query
```sql
SELECT p.proname,
       p.prosecdef AS security_definer,
       pg_get_userbyid(p.proowner) AS owner,
       p.proacl::text AS acl,
       p.proconfig::text AS settings,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
AND p.proname IN ('bs_apply_openapi_bootstrap','bs_apply_openapi_preview',
                 'bs_apply_openapi_preview_events','bs_sync_openapi_today')
ORDER BY p.proname;
```
