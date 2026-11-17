# AI司令塔 隔離Supabase実DB検証結果 — 2026-11-17

## Boundary
Parent production project: `rzosrbkyniyedolhkgxo` (**no writes**).
Created isolated branch: `agent-controller-isolated-validation-20261117`, ref `wuhjcgoerudnjcttpfly`, branch ID `2787f0cf-4f39-418f-ab74-75348ff6a7bb`. Hourly branch price explicitly approved at USD 0.01344/h. Existing PR #294 branch untouched.

## Evidence
1. Isolated branch reached `FUNCTIONS_DEPLOYED` / `ACTIVE_HEALTHY`.
2. Read-only `SELECT current_setting('server_version')` returned PostgreSQL `17.12`; `agent_monitor` did not exist initially.
3. Applied isolated-only migration `agent_monitor_isolated_validation_only`: three tables, two unique indexes, RLS enabled; no public grants, no Cron or external delivery.
4. Transaction-scoped test inserted one attempt event, attempted the same incident reservation twice with `ON CONFLICT DO NOTHING`, and attempted two outbox rows for the same incident with `ON CONFLICT DO NOTHING`. Counts inside transaction: `events=1`, `incident_reservations=1`, `outbox_entries=1`. Rolled back.
5. PostgreSQL catalog confirmed RLS enabled on all three tables, `anon` SELECT false, `authenticated` INSERT false.
6. After rollback, all three table row counts were zero.
7. Deleted **only** the new branch via its exact ID. Subsequent parent branch listing contained only existing main and PR #294 branches; isolated ref absent.

## Limits / HOLD
- This proves schema DDL execution and sequential unique-key conflicts in an isolated PostgreSQL instance, **not** true parallel transaction races, idempotent external notification delivery, crash recovery, real role impersonation, SQL query latency, or production safety.
- No notification delivery, production SQL, deployment, PR merge, or scheduler changes were performed.
- Production release remains HOLD pending separate approval and remaining evidence.
