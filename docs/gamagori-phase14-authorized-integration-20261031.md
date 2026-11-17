# PHASE14 — conditional environment approval follow-up

**Verdict: HOLD.** The user's approval was specific to three temporary server-only variables on Preview + gitBranch `feature/gamagori-chart-collector`, pointing exclusively to `rdqnqvafsponsoetnezv`, followed by cleanup. It does not authorize new Automation Bypass keys or any production mutation.

## Completed measurements

- Re-ran the entire existing regression set including the isolation repair test: **162 PASS / 0 FAIL**, SQL36 embedded. See `gamagori-phase14-authorized-tests-20261031.txt`. This is local verification, not protected Preview integration.
- Managed isolated attestation still confirms project/ref, isolated stage, no fixture RPC reference, authoritative meeting RPC source hash, nine collector read-contract column signatures, and disabled shared-source writes.
- Actual shared-source meeting RPC returned `{"date":"2026-10-31","races":[],"live_sync":null}`. The isolated source tables have no live source feed. There is no basis to infer a normal meeting or six fresh boats.
- Ran `tests/sql/gamagori-phase14-negative-managed.sql` against the managed isolated DB as the real service_role through SQL role switching. It asserts the exact isolated identity before inserting anything. No fixture RPC is installed or substituted.
- For each synthetic negative state (unknown/cancelled/postponed/withdrawn), the real observation RPC accepted a negative observation with checked_at=NULL and collection_permitted=false. Identical re-execution inserted 0. The real chart-save RPC rejected it with `observed_latest_not_verified`.
- Missing observation was rejected with `observed_observation_missing`; actual anon execution of attestation was denied. All synthetic observations were **ROLLBACK**, leaving chart rows=0 and observation rows=0. These are synthetic negative contract tests, not live official cancellation measurements or a successful chart save.
- Production SELECT-only integrity check: **198R / 1,188 boats**, duplicate keys=0, incomplete races=0. No production writes were issued.
- Vercel project metadata listed 75 variables. Dedicated variables matching the three approved names were absent across the project. Final metadata (id/key/type/targets/gitBranch/updatedAt) matches the initial snapshot for all 75 variables. Values were not printed.

## Concrete execution blockers

The currently exposed Supabase connector provides publishable/anon keys only; it has no service_role/secret-key retrieval operation. No production service key was retrieved or substituted. Creating or signing an alternative credential was not attempted.

The currently exposed Vercel connector can create/edit variables but has no variable deletion operation. Local checks found neither a Vercel CLI installation nor an existing standard Vercel auth file or VERCEL_TOKEN/VERCEL_OIDC_TOKEN environment credential. A temporary credential must not be installed when the required cleanup route is unavailable. Accordingly, **none of the three variables was created**; no partial two-variable configuration or placeholder secret was installed.

The connected deployment URL fetch helper creates/reuses a temporary share link; it was not used to work around the user's authentication constraint. No new Automation Bypass key or protection setting change was made. Protected Preview HTTP execution remains unavailable through the currently verified authentication paths.

Browser fallback to the signed-in Supabase/Vercel management UI could provide the missing key retrieval and deletion path. The computer-use tool's governing instructions explicitly require user approval before falling back when a service plugin is insufficient; no browser session was initialized in this follow-up. Approval for this fallback concerns the execution surface only, not a new credential, new bypass, production change, or broader environment scope.

## Not executed — no PASS credit

| Item | Status / reason |
| --- | --- |
| All three branch-only variables configured | NOT EXECUTED: isolated secret retrieval and guaranteed deletion route unavailable |
| Preview redeploy with isolated credentials | NOT EXECUTED: configuration prerequisites unmet |
| Authenticated Preview attestation/API call | NOT EXECUTED: no verified existing CLI/OIDC access path |
| Before-cutoff live sale/six boats/entry/registrations/chart comparison | NOT EXECUTED: no fresh isolated source feed and no authenticated runtime path |
| Actual six-boat normal save / retry +0 / overlapping HTTP calls | NOT EXECUTED: above prerequisites unmet |
| New deployment runtime safe-stop after deleting three variables | NOT EXECUTED: no temporary variables/deployment created; absence and unchanged metadata verified only |

No production merge, deployment, migration, Cron activation, Deployment Protection change, existing shared-variable update, key issuance, or TRINITY/news/prediction change occurred. Source code remains the isolation guard implementation from `fdc6ae9`; this follow-up adds reproducible test SQL and evidence only.

## Next authorized-scope path

Subject to explicit permission to use the existing signed-in management UI, retrieve only the existing isolated-project secret without displaying it in output; configure exactly the three approved Preview+gitBranch variables; verify the scope and new Preview deployment metadata; reuse existing deployment authentication only. If that authentication still cannot reach the API, stop and ask separately before issuing any new bypass. After tests, delete all three variables, verify absence, and rebuild the Preview without them so immutable deployment environment snapshots do not retain active routing. The existing credential-bearing test deployment also needs to be made inaccessible through an available authorized cleanup path; deleting project variables alone does not remove a prior deployment's snapshot. Do not claim runtime cleanup until it is measured.
