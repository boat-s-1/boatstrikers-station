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
1. **Environment branch restriction conflict:** The environment currently permits only `codex/hatsune-cron-log-finish-guard-20261117`; a workflow running on `main` will be rejected. Do **not** weaken this setting without explicit approval of the exact replacement policy. The single-account repository has no independent Required reviewer.
2. **Credential provenance:** The branch-scoped service key must be created/retrieved from the disposable branch's API settings; never use a parent/production key. This connector cannot retrieve secret keys. Confirm authoritative branch ID/ref and credential ownership before secret registration.
3. **Secret scope:** Register only `PR301_BRANCH_SERVICE_KEY` (and optionally `PR301_BRANCH_ANON_KEY`) as environment secrets after branch creation and independent review. No repo-wide secret. Delete secrets after testing.
4. **Paid branch:** Creating a new branch incurs cost and requires a separate approval; this Draft PR does not authorize it.
5. **Fixture:** Confirm `hatsune_news_cron_runs` schema matches the runner, fixture is isolated, and table has no unrelated rows. Test currently checks DELETE representation but **does not independently query for zero residual rows**. Verify this before release.
6. **Pinned dependencies:** `actions/checkout@v4` is version-tagged, not SHA-pinned. Pin to a reviewed commit SHA before release if supply-chain immutability is required.
7. **Ref allowlist:** The workflow blocks the known production ref but cannot establish that arbitrary other refs are disposable. Confirm branch existence and exact ref out-of-band before running.
8. **Failure handling:** If the process terminates abruptly, `finally` might not run. Independently check fixture cleanup and delete the disposable Supabase branch even on failure.

## Approval boundaries
- This PR is a **design/implementation proposal**, not merged.
- No workflow run, paid branch, key registration, HTTP request, production database/Cron change, or PR301 merge is authorized.
- Keep PR301 Draft/HOLD until real HTTP status evidence and independent cleanup are confirmed.
