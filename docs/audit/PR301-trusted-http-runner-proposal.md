# PR301 trusted HTTP runner — approval gates (Draft only)

This proposal adds a **manual-only** workflow. It is NOT authorization to run it.

## Fixed execution boundary
- Runs from default branch only after a separate merge approval.
- Checks out a **specific commit SHA** (`56516e59e8664cbdce33b7105c9cbd168dab3119`) for the HTTP test, rather than a mutable PR branch.
- GitHub token permissions are `contents: read`; checkout credentials are not persisted.
- Rejects invalid ref format, the known production ref, and absent branch service key before checkout.
- Uses `pr301-isolated-http` environment and does not upload logs/artifacts with credentials.
- The test writes **only** to the supplied branch endpoint, inserts a disposable fixture row, checks PATCH behavior and deletes the row in `finally`.

## Blockers requiring separate review
1. **Environment branch restriction:** User screenshot now shows selected branches/tags with **only `main`** and administrator bypass unchecked. The screenshot cannot independently establish whether the top-level Save protection rules button was pressed. Confirm saved state before merge. The single-account repository has no independent Required reviewer.
2. **Credential provenance:** The branch-scoped service key must be created/retrieved from the disposable branch's API settings; never use a parent/production key. This connector cannot retrieve secret keys. Confirm authoritative branch ID/ref and credential ownership before secret registration.
3. **Secret scope:** Register only `PR301_BRANCH_SERVICE_KEY` (and optionally `PR301_BRANCH_ANON_KEY`) as environment secrets after branch creation and independent review. No repo-wide secret. Delete secrets after testing.
4. **Paid branch:** Creating a new branch incurs cost and requires a separate approval; this Draft PR does not authorize it.
5. **Fixture:** Confirm `hatsune_news_cron_runs` schema matches the runner, fixture is isolated, and table has no unrelated rows. Test currently checks DELETE representation but **does not independently query for zero residual rows**. Verify this before release.
6. **Pinned dependencies:** `actions/checkout` is now pinned to commit `11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2); confirm its provenance during final review.
7. **Ref allowlist:** The workflow blocks the known production ref but cannot establish that arbitrary other refs are disposable. Confirm branch existence and exact ref out-of-band before running.
8. **Failure handling:** If the process terminates abruptly, `finally` might not run. Independently check fixture cleanup and delete the disposable Supabase branch even on failure.

## Approval boundaries
- This PR is a **design/implementation proposal**, not merged.
- No workflow run, paid branch, key registration, HTTP request, production database/Cron change, or PR301 merge is authorized.
- Keep PR301 Draft/HOLD until real HTTP status evidence and independent cleanup are confirmed.

## Hardening added after initial review
- Environment variable `PR301_ALLOWED_BRANCH_REF` is mandatory and must equal the manually supplied branch ref. Set it **only after** verifying the exact disposable branch ref in Supabase; do not copy a production ref. The variable is not a secret.
- Branch service and optional anon credentials are now injected **only into the HTTP execution step**, not into checkout or the preliminary guard step. The preliminary step checks the allowlist before checkout.
- The credential presence check is in the HTTP step. This does not solve credential provenance; an operator must still confirm the branch-scoped key and configure the environment before execution.
- Screenshot review indicates the environment now selects only `main`, and administrator bypass is unchecked. Verify the settings were saved. No secrets were added.

## Final review finding — fixture prerequisite and execution order

**Important:** The proposed workflow does not create the `hatsune_news_cron_runs` fixture. The branch must first be created and confirmed disposable, and `tests/sql/hatsune-cron-log-branch-fixture.sql` must be applied **only to that branch** after checking that the table is absent. Otherwise the HTTP test will fail with a missing table; this is not evidence of an application defect. Never add automatic schema creation to the secret-bearing runner without separate review.

Execution sequence (each step separately gated):
1. Review and explicitly approve PR303 merge to `main` (the workflow will exist but is not automatically run).
2. Confirm the environment's `main`-only restriction was saved and no unrelated workflow can access its future secrets; review all trusted workflows on `main` before secret registration.
3. Obtain fresh paid-branch cost authorization, create disposable branch, verify its ref/health, and apply branch-only fixture using the Supabase connector.
4. Register environment variable `PR301_ALLOWED_BRANCH_REF` with exact branch ref; register **branch-only** credentials as environment secrets. Do not paste credentials into chat.
5. Manually dispatch the workflow on `main` using that ref. Inspect only redacted status results, independently query the disposable branch for zero fixture rows, remove environment secrets and variable, then delete the paid branch even if tests fail.
6. Review HTTP evidence and only then consider PR301 merge and production deployment as separate decisions.

A green PR301 offline CI does not replace these checks. No current tool can independently inspect GitHub environment rules or register/remove its secrets, so steps 2 and 4 require operator confirmation.
