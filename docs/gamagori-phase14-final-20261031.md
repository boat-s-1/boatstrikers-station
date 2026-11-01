# PHASE 14 — HOLD (2026-10-31 UTC)

## Scope and actual results

Production was read-only: 198 races / 1,188 boats remain. No production migrations, merge, deployment, Cron activation, Deployment Protection change, new bypass key, or environment variable changes were performed. Existing TRINITY/news/prediction source files were not changed.

The isolated branch `gamagori-pr294-phase13` (`rdqnqvafsponsoetnezv`) was repaired in place without resetting it. Platform MIGRATIONS_FAILED is historical and remains unresolved as a platform status; the DB itself is ACTIVE_HEALTHY. This is collector read-contract equivalence, not a complete production clone.

## Root cause and isolated repair

The branch creation log at 2026-10-31T06:28:01.036Z contains SQLSTATE 42P01. Migration `20260820210127 ai_v2_public_character_stats` references `public.bs_race_results`, which does not exist in the migration-only branch baseline. Production has shared tables provisioned outside the replayable migration baseline. Increasing HTTP timeouts cannot fix this database issue.

Captured production catalog definitions reproduced nine collector tables (columns/defaults/constraints/indexes/RLS) and six authoritative collector RPCs. Existing source writer triggers, outbound alerts and schedules were intentionally excluded. The service role has read access only to the four shared source tables. The previously failing function definition now compiles inside a rolled-back transaction; no AI function changes were committed.

The PHASE 13 fixture event table, chart rows (6), receipt (1), observations (35), and fixture meeting RPC were moved intact to `gamagori_phase13_archive`. PUBLIC/anon/authenticated/service_role cannot access this schema or its objects. Public chart rows are now **0 real rows**. Synthetic rows are never counted in the 198 real races.

The isolated P12/P13 observation/save definitions were reinstalled to avoid retaining cached references to archived objects. The public meeting RPC now reads the real shared tables. Its source SHA256 is `8405c742bf7f1d230b226ec19fdc20434cc1f8647f01ea8667e765daf24a18c2`.

## Connection guard

Five collector-specific database routes now require a dedicated server-only connection, exact Preview branch scope, a nonproduction project URL/ref, and a successful invoker attestation RPC. No fallback to shared Supabase credentials is allowed. Migration alone supplies no trusted project identity. Missing configuration fails closed before constructing a database client. The guard intentionally rejects production; production operation needs a later reviewed change.

Managed isolated attestation returned: fixture_references=false; authoritative_meeting_rpc=true; collector_read_schema_matches=true; shared_source_writes_disabled=true. Nine column signatures match the captured production catalog. These attestations do not prove source data freshness, trigger equivalence, network reachability, or a live six-boat save.

## Verification and limits

- Main regression suite: **161 PASS / 0 FAIL**, including 14 dedicated connection/attestation tests, previous 147 cases, and the embedded SQL36 matrix.
- Additional repair test: see `gamagori-phase14-repair-tests-20261031.txt`; counted separately, never substitute for managed API integration.
- Managed isolated lease: first acquisition accepted; second owner denied; wrong-owner release denied. Assertions executed inside a rolled-back transaction. This proves SQL contention behavior, not overlapping HTTP invocations.
- Managed isolated real charts: 0; archived fixture charts: 6. Actual normal save / repeated save +0: **NOT EXECUTED**.
- Existing cancellation/withdrawal/timeout/fetch-failure regression fixtures pass in the main suite. Live Vercel failures: **NOT REEXECUTED**.
- Production count rechecked: 198 races / 1,188 boats. No writes were issued to production.

## Official network and live-race limitations

Earlier Vercel evidence distinguishes successful DNS/TLS from an official BOATRACE HTTP response timeout, while Gamagori itself returned HTTP200. This narrows the issue to HTTP/upstream/egress-path behavior but does not identify whether WAF, transport, region or upstream routing is responsible. The requested hnd1 diagnostic previously ran in iad1; it is not evidence of a Japan-region test. No timeout increase or speculative WAF bypass was implemented. Fresh H1/H2 and actual-region comparison remain unverified behind protected Preview authentication.

At the PHASE14 check (2026-10-31 23:21 JST), no same-day before-cutoff Gamagori race remained available. Archive replay must not be presented as fresh normal-sale confirmation. Shared isolated source tables are empty; HTTP200 or successful schema creation does not populate or verify fresh six-boat evidence. Official sale + venue07/date/R/update-time + six registrations/exhibition/entry/chart agreement remains required. Unknown/stale/cancelled/withdrawn/incomplete information must stop collection.

## Concrete approval-dependent next step

Add ONLY these server variables, scoped to Preview and gitBranch `feature/gamagori-chart-collector`:

1. GAMAGORI_EXPECTED_PROJECT_REF = rdqnqvafsponsoetnezv
2. GAMAGORI_SUPABASE_URL = https://rdqnqvafsponsoetnezv.supabase.co
3. GAMAGORI_SUPABASE_SERVICE_ROLE_KEY = isolated-project secret (never print or commit)

No shared/production Supabase variable changes. Impact: collector routes in this branch only; rollback: remove the three branch overrides, restoring fail-closed behavior. Existing deployment authentication must be reused first; no new bypass key is authorized by this report. If no existing authenticated route works, request separate permission with the exact method and lifetime before issuing anything.

After approval and a new Preview: attest target DB; acquire fresh read-only source evidence without modifying existing synchronizers; run before-cutoff official checks; save six real rows in isolation; retry expecting +0; test overlapping authenticated calls; verify negative latest observation and timeout paths; compare all counts and permissions. No production GO until those integration steps pass.

## Verdict

**HOLD**. The schema dependency and fixture contamination issues are addressed in isolation. Protected Preview routing, live official sale retrieval, fresh six-boat data, real atomic save/re-execution and overlapping HTTP requests remain unverified. No PASS credit is assigned to those items. Full shared-schema baseline replay and the branch platform failure flag also remain limitations.
