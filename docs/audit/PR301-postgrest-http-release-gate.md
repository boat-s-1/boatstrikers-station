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
6. Verify successful HTTP POST, PATCH with `Prefer: return=representation`, no-matching-row PATCH, and (when supplied) denied anon PATCH. Confirm the test row was removed; query the branch table to ensure zero rows.
7. Delete the paid branch immediately and verify it is absent from the branch listing, **including on test failure**.

## Failure handling

- Any missing credential, incorrect ref, HTTP error, unexpected representation, or failed cleanup is **HOLD**, not PASS.
- If the script fails before cleanup, remove test data **only on the disposable branch**, then delete the branch.
- Do not invoke the Hatsune cron route, change production tables or policies, merge the PR, or deploy.
- Record the branch creation/deletion, HTTP status outcomes (without secrets or raw sensitive responses), and CI result in PR #301.
- A successful raw REST PATCH confirms PostgREST wire behavior; it is **not by itself** proof that the application `supabase-js` `.maybeSingle()` call behaves correctly. For that, run a separate client-level integration test or capture a safe application-client trace in the same isolated environment.

## Current evidence

- PR #301 HEAD `f31ade4`: Hatsune and Discord CI SUCCESS, including HTTP script syntax check.
- Previous disposable Supabase branch: SQL transaction insert/update returned a row; anon/authenticated lacked UPDATE table privileges; rollback left zero rows; branch deleted.
- **No actual PostgREST HTTP integration test has yet been executed.**
