# PHASE14 browser-authorized integration — HOLD

Actual window: 2026-10-31 23:57 to 2026-11-01 00:20+ JST. No production mutation, merge, migration, production deployment, Cron registration, Deployment Protection change, new Automation Bypass key, or source-key rotation occurred.

## Configuration and cleanup evidence

The dedicated Supabase branch was positively identified in the management UI. Its existing service_role key was read in browser memory without printing or screenshotting it. JWT role and ref were checked against `service_role` and `rdqnqvafsponsoetnezv`. No key was created or changed. The revealed page was closed; the memory variable was cleared after use.

Three Secret variables were saved through the Vercel UI:

| Name | Variable ID | Target | gitBranch |
| --- | --- | --- | --- |
| GAMAGORI_EXPECTED_PROJECT_REF | MgZ4KACvTMJAqdb5 | preview only | feature/gamagori-chart-collector |
| GAMAGORI_SUPABASE_URL | OYUoIwykMx3iaG96 | preview only | feature/gamagori-chart-collector |
| GAMAGORI_SUPABASE_SERVICE_ROLE_KEY | a9l2srLsHTw3m5v8 | preview only | feature/gamagori-chart-collector |

Server metadata independently confirmed all three target/branch restrictions. Creation timestamp: 2026-10-31T14:57:34.692Z. No values appear in this evidence. [Configured UI, no secret values](gamagori-phase14-browser/configured.jpg).

All three were subsequently deleted individually through Vercel UI. Server-side final metadata: **75 variables; temporary variables 0; all other variable metadata unchanged** (id, key, type, target, gitBranch, updatedAt). Existing SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL were not edited. [Removed UI](gamagori-phase14-browser/removed.jpg).

## Preview and authentication measurements

A temporary `/admin/gamagori-preview-validation` panel was added in commit `65e134cd937d7dd37e5f95acd547dfe86f7a8d03`, gated to this Preview branch. It calls only existing fixed collector APIs with a manually supplied Bearer header, never injects server credentials and never changes API authentication. Deployment `dpl_2gLUhD5r39bDkzb1D7Lerk8p8buX` reached READY after variable creation. The browser passed existing Vercel authentication, and secure admin login positively reached the validation panel. These are UI/auth/build results, not database integration success.

Reading the existing GAMAGORI_COLLECTOR_SECRET through Vercel UI required email-code step-up verification. Secure browserAuth submissions returned submitted, but the rendered UI did not confirm successful revelation and continued to require verification. No plaintext Collector secret was obtained. After bounded attempts, verification was cancelled; no permission changes or alternative credentials were created. Therefore no authorized collection API action was executed.

After removing all three variables, the exact Preview commit was redeployed as `dpl_4gZoJbyNFxYpxQnjsLWNkYgmac9E`, target=null (Preview), branch=feature/gamagori-chart-collector, region=iad1, and reached READY. The first redeploy API request with target="preview" was rejected by the provider with 400; the corrected request redeployed the existing Preview without a production target. This is a recovered request error, not a collector test failure.

On the cleanup Preview, a normal browser navigation to `/api/admin/gamagori-chart-monitor` returned `{"error":"unauthorized"}`. This proves the application authorization gate remains active; it does **not** prove the isolated database configuration gate ran. No authenticated post-removal runtime call was possible, so runtime fail-closed verification remains **UNVERIFIED**. The earlier 162 passing local tests include missing-configuration fail-closed tests; they do not substitute for this runtime measurement.

The temporary validation panel is removed in the final evidence commit; it is not required for the production design. That final commit triggers another credential-free Preview build.

## Data integrity

Production was accessed through SELECT only before/after: **198 races / 1,188 boats**, duplicate keys=0, incomplete races=0. No chart collection or source synchronization was triggered from the admin dashboard. Isolated public charts=0, public observations=0. The archived PHASE13 synthetic six rows remain separate from real data. No test result is counted as a new collected race.

Managed isolated attestation remained: stage=isolated; project_ref=rdqnqvafsponsoetnezv; fixture_references=false; authoritative_meeting_rpc=true; collector_read_schema_matches=true; shared_source_writes_disabled=true. This is SQL-side verification, not an application-runtime attestation result.

## Explicit limits and verdict

| Check | Result |
| --- | --- |
| Three branch-only variables installed and scope verified | PASS |
| Protected Preview built; existing Vercel and app admin UI authentication | PASS |
| All three variables removed; existing 75 metadata unchanged | PASS |
| Post-removal Preview redeployed READY | PASS |
| Unauthenticated API call denied | PASS, authorization only |
| App runtime → isolated DB / attestation | UNVERIFIED: existing Collector secret not obtained |
| Runtime DB safety stop after deletion | UNVERIFIED: no valid Bearer call |
| Live official sale / six fresh boats / courses / registrations / chart | NOT EXECUTED: no authorized API path; overnight window |
| Six real chart save / retry +0 / overlapping authenticated HTTP requests | NOT EXECUTED |
| Vercel official sale HTTP timeout root cause | UNRESOLVED; no new runtime probe executed |

**HOLD; do not call this workflow successful.** Configuration cleanup is complete, but the user's required authenticated runtime safety-stop verification is not.

Vercel environments are immutable deployment snapshots. Removing project variables does not purge the previous credential-bearing deployment snapshot. The old test Preview remains protected; its snapshot has not been deleted or its source credential rotated. Do not claim that all copies of the credential were revoked. No production action is authorized by this report.
