# PHASE14 — isolated service_role dependency audit

**Decision: HOLD. No key retirement, generation, rotation, Edge Function invocation/change/deletion/redeployment, database mutation or Cron change was performed. PR294 remains Draft.** Baseline:6948b50. This is a read-only dependency investigation, not a new integration-test PASS count.

## Concrete function dependencies

The deployed source was fetched through the management API for both isolated project `rdqnqvafsponsoetnezv` and production `rzosrbkyniyedolhkgxo`. Matching function IDs, versions, bundle SHA256 and identical source content establish shared code artifacts; they do not establish shared runtime credentials.

| Function | Metadata | Environment reads | Database operations | Other outbound access |
| --- | --- | --- | --- | --- |
| collect-boatstrikers-news | ACTIVE, v13, verify_jwt=true | SUPABASE_URL; SUPABASE_SECRET_KEYS; GEMINI_API_KEY; GEMINI_MODEL | GET duplicate source_url lookup; POST insert into bs_news_candidates | POST Google Gemini interactions with x-goog-api-key |
| collect-boatstrikers-media | ACTIVE, v2, verify_jwt=true | SUPABASE_URL; SUPABASE_SECRET_KEYS | POST upsert bs_media_videos on video_id; DELETE rows older than120days by published_at | GET public YouTube feeds, up to24channels, batches6 |

The news source has195 lines; media140. The machine-readable companion records the source line anchors and bundle hashes without storing full source, environment values or credentials.

**Neither function reads SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.** Their internal getSecretKey parses the platform-injected SUPABASE_SECRET_KEYS JSON, preferring `default` and falling back to the first value. All REST requests derive the base URL from SUPABASE_URL. No hardcoded production or isolated project reference occurs in either source. The selected modern secret is placed on both apikey and Authorization headers for REST access.

Consequences:

- Retiring only the isolated legacy JWT pair should not directly remove the source's modern internal DB credential; this is static analysis, not a measured no-downtime guarantee.
- Rotating/deleting the selected modern default secret would affect internal REST access in both functions. Merely creating another named key will not necessarily change selection while `default` exists.
- Both handlers reject non-POST methods before business work. No endpoint was called in this audit. In particular, the media POST may delete historical rows; an empty request is not a read-only test and must not be used for validation.
- News checks GEMINI_API_KEY before research. Its key is sent only to the fixed Google API endpoint; no Gemini call was made here. Media uses public feeds without a third-party API credential. Actual presence/value of the optional custom environment configuration was not verified.

## Incoming authentication is a separate dependency

Both deployments have verify_jwt=true. Neither source inspects req.headers, checks caller roles/users/claims, or uses withSupabase/jwtVerify. The platform gate is therefore the observed incoming authentication mechanism, not a handler-level restriction to the legacy service_role credential. Successful production logs demonstrate anon-role callers. This distinction is material: retiring the legacy pair can affect anon-based callers even though function-internal DB access uses modern secret keys.

Do not substitute a modern opaque key into an existing Bearer/JWT workflow and claim success without a compatibility test. Current migration documentation has platform-compatibility qualifications, and these handlers have no explicit modern-key authorization wrapper. We did not disable verify_jwt or propose changing these functions under this authorization.

## Schedules and callers actually inspected

Production cron.timezone=GMT;24jobs total;0commands contain the isolated project ref. Two matching jobs were inspected using safe boolean projections, never full command text or credential values:

| Job | Actual schedule (GMT/UTC) | Destination/auth evidence |
| --- | --- | --- |
| #11 boatstrikers-news-daily-2300-jst | 0 3,6,9,14 * * * | Production endpoint; Bearer; Vault lookup |
| #12 boatstrikers-media-hourly | 0 3,6,9,13 * * * | Production endpoint; Bearer+apikey; inline JWT payload projects to production ref and anon role |

The schedules run at12:00/15:00/18:00/23:00 JST for news and12:00/15:00/18:00/22:00 JST for media. Names alone do not describe the actual frequency. No schedule or credential was changed. The Vault-backed news token was not decrypted; its role is supported by actual production logs, not assumed from its secret name.

The isolated project has no cron.job relation,0Vault secrets,0supabase_functions.hooks rows,0public http_request webhook triggers and0matching public SQL-function source references to these endpoints. The production SQL-function literal-reference scan also returned0. Production has3Vault secrets, whose values were not read. A catalogue query for production supabase_functions.hooks initially failed because that relation is absent; the subsequent trigger/Vault check was adjusted. This is a recovered audit-query mismatch, not a regression test failure.

PR6948b50 vercel.json was inspected. News-morning-collect and media-editorials call their own imported application collectors, not the two Edge Function endpoints. Those inspected modules use the existing shared Vercel Supabase configuration; they must not be rewritten or rotated as part of isolated-key retirement. Indexed GitHub searches for both slugs and the isolated ref returned0matches, but indexed/default-branch search is not a complete repository, historical CI, local-machine or third-party consumer inventory.

## Observed separation and its limits

The final log window is **2026-10-31T06:00:00Z through2026-10-31T20:39:08.465Z** (2026-10-31 15:00 through2026-11-01 05:39:08.465 JST). It covers the available investigation period, not all historical use.

- Isolated function_edge_logs/function_logs: no records returned.
- Production: news3 and media3 function-edge records, each HTTP200, caller_role=anon, request.host and project_ref explicitly production. Function console-record counts are separate and must not be added as invocations.
- Neither log headers, authorization values, signatures nor complete event messages were exported.
- Both public JWKS endpoints returned200. Isolated current ES256 kid=131ca443-c615-476a-9168-27088b1d4922; production kid=ff1edb5d-bbe5-4268-a121-dac2c13967e6; public key documents differ. This confirms distinct current public signing configurations. Legacy HS256 secrets are not published in JWKS and were not compared or exported.
- Isolated source tables bs_news_candidates and bs_media_videos are absent, while both exist in production. Thus these isolated functions are not currently demonstrated to support normal collection against the recreated collector-only schema. Do not infer that they are healthy or safe to invoke just because metadata says ACTIVE.
- The previous branch UI lists function endpoints under rdqnqvafsponsoetnezv. Source-artifact entrypoint paths contain the parent ref but source itself has no hardcoded parent URL. Official platform documentation defines SUPABASE_URL and SUPABASE_SECRET_KEYS as project-specific injected values.

**Static routing, project identity, schedules and public signing configurations are separated in the inspected evidence. Actual runtime environment values were not verified.** The isolated Secrets management page currently requires sign-in; no further credential/MFA attempt or secret-value retrieval was made. No secret-list tool is exposed by the connector. We therefore cannot assert a runtime SUPABASE_URL/key ref match, custom Gemini configuration, or absence of unknown external callers solely from source and zero recent logs.

## Designed retirement procedure — separate approval required

The credential retained by the now-deleted Preview is the isolated **legacy service_role JWT**, not either function's selected modern default secret. Prefer retiring that old credential specifically, not broad rotation of unrelated modern keys.

### Preconditions

1. Reconfirm exact branch ref rdqnqvafsponsoetnezv, production exclusion, old Preview404, temporary Vercel variables0 and original75metadata baseline. No parent project operation, branch merge/reset, common-key change or function operation is authorized.
2. Inventory external callers/CI/local tasks and obtain owner confirmation that any isolated legacy callers may stop. Preserve the two function metadata fingerprints and catalogue baselines. Zero logs in the measured window is insufficient.
3. Verify environment binding through an approved read-only supported mechanism without returning values. Do not invoke either existing POST to expose runtime diagnostics. Any additional diagnostic deployment or configuration work needs separate authorization; it is not implemented here.
4. The isolated signing UI previously showed current ECC(P-256) and a previous HS256 key. Re-read immediately before action; never revoke the current ECC key. Determine whether the old HS256 key is still trusted by any remaining isolated user/service consumer.
5. Separately approve deactivation of **both legacy anon and service_role keys** and retirement of the previous legacy signing secret. Explain that legacy-authenticated isolated callers can stop. No legacy key was reissued in this audit.

### Execution design

After preconditions and approval, use only the isolated project's supported API Keys/JWT Keys interfaces to disable the legacy pair and revoke the previous legacy signing key. Existing modern keys and current asymmetric signing key remain unchanged. Simply creating another modern key or deleting another Preview is not retirement. Do not alter the two functions or production Cron to make a test pass.

If future operation requires rotating a modern secret, treat it as a different change: identify every consumer of the `default` selector first, plan its exact replacement/selection behavior, and obtain separate approval. A new key name alone is not an effective migration for the current source.

### Post-change validation design

- Verify control-plane state for the isolated legacy pair and previous key. Use the previously retained legacy credential only against a read-only endpoint in the isolated project and preserve status/ref booleans only. This must not invoke news/media POST or touch production.
- Confirm an approved modern credential can still perform a read-only isolated query; validate current JWT public configuration. Confirm expected rejection of retired legacy incoming credentials separately from internal DB access.
- Recheck original75Vercel metadata, temporary3=0, production charts198R/1,188boats, duplicate/incomplete0, isolated charts/observations, and unchanged function fingerprints/schedules.
- Normal news/media function validation is **not available** against the present isolated schema without additional approved setup. It remains unverified; do not use production writes as a substitute.

### Recovery

Stop on an unexpected consumer or scope mismatch. Re-enabling legacy keys restores the old credential and is not a secure recovery for a retirement task. Revocation of signing material must not be assumed reversible. The forward recovery is to migrate an approved isolated consumer to an already-reviewed modern credential or current JWT mechanism, after separately approved caller changes. Do not reset the branch, rotate production keys, or restore a credential-bearing Preview. If the requirement is zero interruption to every possible isolated caller, the present evidence is insufficient to authorize execution.

## Current integrity and decision

Old Preview lookup still returns404. Original75Vercel variable metadata is unchanged during this audit; temporary3variables=0. Production remains198R/1,188boats, duplicates0/incomplete0. Isolated charts0/observations0/Auth users0; collector SQL attestation still has all safety predicates. No new race was collected or saved.

**Key change verdict: technically scopeable to the isolated project, but NOT GO for an unconditional/no-impact rotation.** Direct legacy-key use inside these two deployed sources is ruled out; incoming legacy-auth dependencies and live runtime binding remain the blockers. Controlled retirement is only a future, separately approved operation with an accepted isolated-caller impact. PR stays Draft/HOLD, and authenticated Gamagori API integration remains unverified.

## Primary sources

- https://supabase.com/docs/guides/functions/secrets — project-injected runtime variables
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys — incoming API-key/JWT migration qualifications
- https://supabase.com/docs/guides/security/rotate-leaked-api-keys — legacy-pair deactivation and legacy signing-secret retirement
- https://supabase.com/docs/guides/auth/signing-keys — signing-key trust and legacy coupling

The changelog markdown index fetch was attempted but the web reader rejected its content type; no implementation or migration relying on a changelog change was performed.
