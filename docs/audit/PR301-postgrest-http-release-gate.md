# PR #301 — isolated PostgREST HTTP release gate

Status: **HOLD until a real HTTP test passes**. Offline CI and isolated SQL tests do not establish PostgREST behavior.

## Execution prerequisites

1. Create a **fresh, disposable, no-production-data** Supabase branch of project `rzosrbkyniyedolhkgxo`. Confirm the current hourly cost and obtain explicit approval before creation.
2. Confirm branch project ref differs from production and is ACTIVE_HEALTHY. The fixture is intentionally **not** a production migration.
3. Apply `tests/sql/hatsune-cron-log-branch-fixture.sql` to the **branch only**, after verifying `public.hatsune_news_cron_runs` does not exist.
4. Use an execution environment with outbound HTTPS and **branch-only** service-role credentials, injected as protected environment variables. Never commit, paste into PR comments, print, or pass them as command-line arguments. Do **not** run the script from a public pull_request workflow with untrusted code.
5. Run `node tests/hatsune-cron-postgrest-http.mjs` with:
   - `PR301_BRANCH_REF`: disposable branch project ref
   - `PR301_BRANCH_SERVICE_KEY`: branch-only service-role credential
   - `PR301_BRANCH_ANON_KEY`: optional branch anon key (required to exercise the anon-denied test)
6. Verify successful HTTP POST, plural PATCH with `Prefer: return=representation`, no-matching-row plural PATCH, singular PATCH with `Accept: application/vnd.pgrst.object+json` returning an object, singular zero-match returning HTTP 406 / `PGRST116`, and (when supplied) denied anon PATCH. Confirm DELETE returned exactly the inserted row ID (using `Prefer: return=representation`); independently query the branch table to ensure zero rows.
7. Delete the paid branch immediately and verify it is absent from the branch listing, **including on test failure**.

## Failure handling

- Any missing credential, incorrect ref, HTTP error, unexpected representation, or failed cleanup is **HOLD**, not PASS.
- If the script fails before cleanup, remove test data **only on the disposable branch**, then delete the branch.
- Do not invoke the Hatsune cron route, change production tables or policies, merge the PR, or deploy.
- Record the branch creation/deletion, HTTP status outcomes (without secrets or raw sensitive responses), and CI result in PR #301.
- A successful singular REST PATCH confirms the PostgREST wire contract used by `.single()`; it is **not by itself** proof that the application `supabase-js` `.single()` call behaves correctly against live PostgREST. Offline real-library integration now passes, but live authenticated HTTP remains a separate required gate.

## Current evidence

- PR #301 HEAD `8119a2e6`: Hatsune CI run `44128792916` SUCCESS and Discord/Next.js run `44128792771` SUCCESS. Actual pinned `@supabase/supabase-js@2.53.0` client test passed matched, zero-row and denied scenarios with offline mocked fetch. This detected that `.maybeSingle()` returned arrays for the PATCH response; production completion code was changed to `.single()` and associated tests updated.
- Previous disposable Supabase branch: SQL transaction insert/update returned a row; anon/authenticated lacked UPDATE table privileges; rollback left zero rows; branch deleted.
- **No actual PostgREST HTTP integration test has yet been executed.**

## No-cost prerequisite before another paid branch

The previous approved paid branch attempt was deleted without HTTP execution because the available Supabase connector cannot retrieve a branch-only service-role key or perform authenticated PostgREST requests. **Do not create another paid branch until the following route is ready.**

1. Prepare a trusted, manually triggered execution environment (for example, a protected GitHub Actions environment with required reviewers, restricted deployment branches, and repository administrators controlling access). Do not attach branch credentials to PR-triggered workflows, untrusted fork code, logs, comments, or committed files.
2. Confirm a way to inject **only the newly created disposable branch's** service-role key into that environment as a masked, short-lived secret, without displaying it in chat or PR comments. A production service-role key is never an acceptable substitute. The branch ref must be passed independently and checked against the known production ref before any network request.
3. Confirm outbound HTTPS to the disposable branch and availability of Node.js 22. Use the existing `tests/hatsune-cron-postgrest-http.mjs` runner; its test row cleanup is best effort, so always independently verify the table has zero rows before deleting the branch.
4. Only after the secure route is proven without a paid branch, seek fresh approval of the hourly rate, create the branch without data, check health, apply the branch-only fixture, execute HTTP tests, and delete the branch in a finally-style cleanup process even if tests fail.
5. Treat HTTP success as a separate gate from the already green offline supabase-js client tests. Keep the PR Draft/HOLD until both are evidenced and reviewed.

### Attempt log — 2026-11-18 JST

User approved US$0.01344/hour. Created `pr301-http-isolated-20261118-b` (ref `oomwtipsfpevfdxaazlw`, no production data). Confirmed `ACTIVE_HEALTHY`; no branch credential injection route was available, so **no fixture or HTTP test was run**. Deleted branch ID `6116af99-0988-4217-a023-6b3b47f5509e` and verified absence in branch list. Production untouched.

## GitHub environment configuration reported by operator

The operator reports creating the GitHub environment `pr301-isolated-http`, restricting it to the PR branch, leaving Required reviewers and Wait timer unset (only one account available), disabling administrator bypass, and saving protection rules. **These settings were reported in chat and are not independently verified by the current GitHub connector.** Without Required reviewers, this environment does **not** provide a human approval gate; branch restrictions alone are insufficient to protect a service-role secret from malicious edits on an allowed branch.

### Additional gate before injecting a branch service-role secret

- Do not add a secret to the environment while the allowed PR branch can freely edit workflow files or test scripts. A workflow on the allowed branch could exfiltrate the secret. Establish a trusted immutable execution ref or independently protected code path first, with access to the secret only after code review. A manual-only trigger does not eliminate this risk.
- `workflow_dispatch` workflows generally must be present on the repository default branch to be discoverable for manual dispatch; adding one only to this Draft PR branch is not a complete runnable solution. Do not push a secret-bearing workflow to the default branch without explicit authorization and review.
- Current GitHub connector cannot administer environment secrets, environment protection settings, or dispatch a workflow. Do not claim any of those operations are complete.
- Use the existing no-secret offline CI while planning the trusted runner. Never register production service-role keys in this environment.

## Secure runner design decision (no production changes)

**Recommended approach: trusted default-branch runner, not a PR-branch workflow with secrets.** The trusted runner must be reviewed separately before it is installed on the default branch; this PR does not authorize a default-branch change. A manually dispatched job can use a protected environment, but its executable script and dependencies must come from a reviewed, pinned commit rather than checking out a mutable PR head. Restrict the job to an explicit allowlist of the expected test script SHA and branch ref, refuse the production project ref, and reject missing/empty branch-only credentials before network access.

Before the protected secret is registered, confirm that users able to modify the trusted workflow, its reusable actions, or its checked-out script cannot use that privilege to expose it. A single-account repository without required reviewers cannot provide independent human approval; if this trust boundary cannot be established, **HOLD** and run the branch-only HTTP test interactively through an authenticated trusted browser or an alternative isolated runner instead. No automated path should silently promote this PR to main.

The test itself must remain bounded to the branch-only table: verify the fixture's table identity and zero-row baseline before testing; record only HTTP status codes and schema-safe assertions; verify final zero rows; delete the disposable branch even on test failure. Keep branch credentials out of stdout, artifacts, PR comments, and version control. The environment `pr301-isolated-http` is **not yet approved for secret registration**.

**Release evidence still missing:** actual branch-only service-role credential injection, successful singular PATCH HTTP 200/object and 406/PGRST116 responses, cleanup and deletion confirmation. Until all are observed, retain Draft/HOLD.
