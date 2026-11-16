# Production RLS and function ACL reference

Read-only catalog capture, 2026-11-17. Review reference for isolation, not an executable migration. All six tables: postgres owner, RLS enabled, FORCE RLS disabled, ACL grants postgres/anon/authenticated/service_role. Related three have no policies.

## Core SELECT policies

- `bs_race_entries`: `Public read bs_race_entries`, SELECT, USING (true), roles anon, authenticated.
- `bs_race_entries`: `public read bs_race_entries`, SELECT, USING (true), roles anon, authenticated.
- `bs_race_events`: `Public read bs_race_events`, SELECT, USING (true), roles anon, authenticated.
- `bs_race_events`: `public read bs_race_events`, SELECT, USING (true), roles anon, authenticated.
- `bs_race_results`: `Public read race results`, SELECT, USING (true), roles anon, authenticated.
- `bs_race_results`: `public read bs_race_results`, SELECT, USING (true), roles PUBLIC.

The differing capitalization in policy names is intentional. PUBLIC applies to the lower-case results policy.

## Function ACL

| Signature | SECURITY DEFINER | Owner | ACL |
|---|---|---|---|
| `undefined` | true | postgres | `{postgres=X/postgres,service_role=X/postgres}` |
| `undefined` | true | postgres | `{postgres=X/postgres,service_role=X/postgres}` |
| `undefined` | false | postgres | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |
| `undefined` | false | postgres | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |
| `undefined` | false | postgres | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |
| `undefined` | false | postgres | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |
| `undefined` | false | postgres | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |
| `undefined` | true | postgres | `{postgres=X/postgres,service_role=X/postgres}` |
| `undefined` | true | postgres | `{postgres=X/postgres,service_role=X/postgres}` |
| `undefined` | false | postgres | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |
| `undefined` | false | postgres | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |
| `undefined` | false | postgres | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |
| `undefined` | false | postgres | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |

Four SECURITY DEFINER functions are limited to postgres and service_role: bootstrap, alert capture, theory settlement and settlement trigger. Preserve exact EXECUTE privileges when recreating; Postgres default PUBLIC EXECUTE must be revoked for these. Other functions have PUBLIC EXECUTE in current production. Compare owners and search_path after installation. Do not make this production write path available to anon/authenticated.
