# PHASE14 addendum — old Preview credential retirement plan

**HOLD. Read-only investigation; no deployment deletion or credential change executed. PR294 remains Draft.** Baseline evidence: commit6055f09. Previously reported162 local PASS/0 FAIL and SQL36 are inherited results, not newly executed integration tests.

## Exact deletion candidate

- Vercel project: boatstrikers-station / prj_iKWrqS29BRLCIWKHoDe1SFOTH8Y2
- Team: team_rNunZeEWQozAOqhFtLVQ1d0v
- **Only candidate: dpl_2gLUhD5r39bDkzb1D7Lerk8p8buX**
- URL: https://boatstrikers-station-7dajpkr6q-boat-s-1s-projects.vercel.app
- Management page: https://vercel.com/boat-s-1s-projects/boatstrikers-station/2gLUhD5r39bDkzb1D7Lerk8p8buX
- Preview, READY/Stale, source branch feature/gamagori-chart-collector, commit65e134cd937d7dd37e5f95acd547dfe86f7a8d03.
- This deployment was built while the three temporary isolated-DB variables existed. Its immutable snapshot must be treated as retaining the existing isolated legacy service_role key. Snapshot contents were not decrypted again.

A live UI check shows an enabled per-deployment Delete menu. No Delete selection, confirmation or mutation was performed. [Menu screenshot, no secret values](gamagori-phase14-retirement/target-menu.jpg).

## Protection, routing and usage

Project settings currently report ssoProtection.enabled=true, deploymentType=all_except_custom_domains. One cookie-free HTTP probe to the exact old URL returned302 to the Vercel SSO endpoint and an Authentication Required response. Redirect query parameters/cookies were neither printed nor retained. Protection is effective for this unauthenticated probe; this does not audit every possible access exception.

Live list_deployment_aliases(old ID) returned[]. get_alias on the branch hostname resolves to **dpl_2Axda6Gh5GyNJ4NA6eQjqAUpKvNv** (6055f09), not the old candidate. The old deployment overview still lists a branch hostname in its historical Domains section; do not treat that display or get_deployment.alias as authoritative current routing.

Production custom domains boat-strike.online and www.boat-strike.online resolve to **dpl_KEiMTsfy7emuXmdpfK5tsby3GhA5**. Do not delete, promote, roll back or redeploy that ID. Cleanup Preview dpl_4gZoJbyNFxYpxQnjsLWNkYgmac9E and current Preview dpl_2Axda6Gh5GyNJ4NA6eQjqAUpKvNv were created after variable removal and are outside the deletion candidate.

A runtime-log aggregate for the candidate since2026-10-31T14:57:34Z returned two log records for `/`; no collector API path appeared in the returned aggregate. These are log counts, not an exhaustive access audit. This does not prove there were no requests, external consumers, or credential use. No evidence of a leak is established by these measurements.

## Approval A — single deployment deletion, recommended first

1. Before execution, re-read candidate project/team/branch/commit/Preview status, the current branch mapping, production-domain mappings, and old deployment alias list. Stop on any unexpected mapping, production target, active alias, or changed identity.
2. Preserve this evidence, the menu screenshot and settings/count baselines. Do not export environment values, source credentials or raw authentication traces.
3. With explicit approval, use only the candidate's individual Deployment Actions > Delete flow. Stop if the dialog targets a project, branch, multiple deployments or any different ID. Do not change retention policy, project pause state, domains or Deployment Protection.
4. Confirm the exact old deployment is no longer available via the management API/UI and URL. A login redirect alone is insufficient proof of deletion. Recheck latest branch routing, production mappings, original75 environment metadata, and production/isolated data counts.

Expected impact: the old direct URL and integrations pinned to it stop working; that snapshot cannot be used for instant rollback. Existing production and current branch routing should remain unchanged subject to step1. Vercel's individual deployment deletion is supported by its official management guide. No broad project action is needed. Exact deletion behavior remains unexecuted.

**Deleting the deployment does not revoke the Supabase key itself or prove that no other copies exist.** Do not replay/redeploy the old credential-bearing snapshot to restore it. Restore any needed code from its commit only after the credentials are retired and with a new reviewed configuration.

## Credential retirement — separate approval and dependency HOLD

The retained credential is a legacy HS256 service_role JWT, not a separately revocable modern sb_secret key. The isolated management UI still offers Disable JWT-based API keys; no disable action was taken. Its JWT signing UI currently shows ECC(P-256) as Current and an HS256 Shared Secret as Previous. Previous key ID:293ec587-d84c-44d4-ab23-3532e2bae8b6. No signing key material was revealed.

According to current Supabase guidance, retiring a legacy service_role credential requires disabling the legacy anon/service_role pair; full retirement also requires revoking the previous legacy signing secret so services that still validate it cannot keep accepting the JWT. Creating a modern replacement alone does not retire the old key. Do not rotate the production/shared JWT secret and do not revoke the current ECC key.

The scope would be **rdqnqvafsponsoetnezv only**. The production project rzosrbkyniyedolhkgxo is explicitly excluded. Branches have separate instances and API credentials, but dependencies of the isolated branch still require inventory before mutation:

- Isolated Auth users=0; source events/entries/results=0; cron.job absent.
- Importantly, the branch has two ACTIVE verify_jwt Edge Functions: collect-boatstrikers-news and collect-boatstrikers-media. The management tool returns inherited parent-reference entrypoint paths, while the branch UI displays their actual endpoints under rdqnqvafsponsoetnezv.supabase.co/functions/v1/. This is source-artifact metadata, not proof of a production endpoint, but dependency use is still unknown.
- Neither function was invoked, edited or redeployed. Their secrets, callers and authorization behavior were not read or changed. Do not assume that changing legacy API authentication has no effect on them.

Proposed sequence, NOT approved for execution: inventory isolated consumers without exposing secrets; identify existing modern replacements and exact branch binding; obtain separate approval for both legacy-pair deactivation and previous-HS256 retirement; execute only within the isolated project using its supported interface; verify the retained old key is denied on a read-only endpoint and confirm expected current-key behavior. Preserve only status and role/ref booleans, not credentials. Re-enabling the old legacy pair would restore the old credential and is not a secure rollback. If dependencies or scope cannot be established, stop and retain HOLD.

No new credential, bypass, account permission, shared key, signing key, function or Cron was changed during this investigation.

## Safe authentication alternatives — none verified usable

Deployment Protection and the app's Collector Bearer authentication are separate gates. An existing logged-in browser can pass Vercel protection; its BoatStrikers admin session does not substitute for gamagoriAuthorized's Bearer requirement. No additional step-up authentication attempt or alternative secret retrieval was made.

- The existing management UI's supported step-up flow remains the appropriate path for viewing the existing Collector secret. Its prior success was not established; do not use hidden state, edit forms, cookies or another endpoint to bypass that check.
- Current vercel curl documentation explicitly permits retrieving **or generating** an Automation Bypass token. It is not safe to run blindly under the prohibition on new bypass keys. No vercel curl, share-link helper or new token was used.
- Trusted Sources can accept a short-lived OIDC token from an already authorized source without a new static bypass key. No accepted caller/token was demonstrated here, and it still does not satisfy the app's Bearer gate. No Trusted Sources rules were changed.

No executable Preview connection-test plan is proposed, because a usable authorized application-authentication route has not been verified. Present such a plan only after that prerequisite is established, as requested.

## Integrity and remaining HOLD

Current Vercel variables=75; temporary dedicated variables=0. This investigation makes no environment writes; exact metadata is compared within this investigation. Production remains198R/1,188boats, duplicate keys0, incomplete races0. Isolated public charts0 and observations0; collector SQL attestation retains all safety predicates. No new data was collected or saved.

Remaining HOLD: approval and execution of single old deployment deletion; isolated-key dependencies and full retirement; usable application Bearer authentication; runtime attestation and post-removal fail-closed measurement; real fresh six-boat normal save/retry/concurrency; official Vercel HTTP timeout resolution. No runtime integration item receives PASS credit.

## Primary documentation reviewed (2026-11-01 JST)

- https://vercel.com/docs/deployments/managing-deployments — individual deletion and rollback/link impact
- https://vercel.com/docs/environment-variables — changes apply only to new deployments
- https://supabase.com/docs/guides/security/rotate-leaked-api-keys — retiring legacy credentials
- https://supabase.com/docs/guides/auth/signing-keys — legacy JWT coupling
- https://supabase.com/docs/guides/deployment/branching — separate instances/credentials
- https://vercel.com/docs/cli/curl — automatic token generation caveat
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources — OIDC and default scopes
