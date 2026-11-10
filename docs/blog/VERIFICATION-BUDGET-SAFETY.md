# PR #295: new local verification safety implementation

This is a new implementation, not a restoration of the missing files. Base commit: `94677eedebfffb7cfef3f857e3d2a87a0f42a61d`. Work happens only in the separate `boatstrikers-pr295-verification` checkout on `verification/pr295-safety`.

## Defaults and trust boundary

An additional explicit smoke-only mode is documented in REAL-AI-SMOKE-ONLY-PLAN.md. It allows one smoke request only, reserves exactly 21.42 JPY in the SAME cumulative 700 JPY ledger, and exits successfully without entering the article verifier. Version-2 approvals explicitly bind mode, current HEAD and source digest as well as the full plan fingerprint. Four-stage remains the default for legacy plans without a mode field; smoke-only must be explicit and cannot reuse a four-stage approval (or vice versa).

Real AI stays HOLD. The only supported real CLI is `scripts/blog/verification-cli.mjs`; the three old real CLI entry points now stop with HOLD. Exported legacy functions remain available to existing mocked tests, so running arbitrary JavaScript or deliberately editing safety files is outside this local operator guard's threat model. This is not an OS sandbox or an OpenAI account billing limit.

A human must verify current official model pricing and USD/JPY, fill a secret-free plan outside Git, then approve the exact displayed phrase. The phrase binds model, budget, number of calls, output path, full plan fingerprint and source digest. Sources, fixed fixture files, prompts and safety scripts are hashed; changes invalidate approvals. Approval expires after one hour, including while waiting for a stage confirmation.

The source guard pins the base commit, allows only the two named verification branches, requires real ancestry with Git replacement objects disabled, and rejects merges or unexpected changes in every intermediate commit. Base files are immutable except three exact SHA-256-pinned legacy-CLI safety wrappers. Only named safety additions are allowed. Index/worktree changes are checked too, and dependency bytes are checked directly so assume-unchanged cannot hide edits. The digest binds base, current commit, branch and source files; committing a change invalidates older approvals but does not disable the runner. Plans and approval records cannot override this policy. This protects against accidental unrelated changes; a filesystem owner who deliberately rewrites the trusted safety code remains outside the threat model.

Approval records and atomic `.used` markers persist outside Git. Every run consumes approval before reserving funds, so cancellation, error, crash and budget refusal do not restore it. The filesystem owner is the trusted approver; do not edit/delete approval or budget records. Keep the same stateDir across attempts. Changing stateDir creates a separate budget pool and must not be used to evade the agreed limit. A lost or uncertain state directory is HOLD, not permission to reset the budget. Restoring an older filesystem snapshot can roll back local consumption/spend records; these local guards cannot detect that rollback. Do not reuse an approval after snapshot restoration without reconciling its history and unknown spend.

## Reservation

- Model fixed: `gpt-6.1-terra`; budget reference: 1,000 JPY; operating limit: 700 JPY.
- Four-stage stages are fixed: smoke, ichika, hatsune, kiina, one call each, maximum four. Smoke-only has only smoke, maximum one. Neither mode automatically retries.
- Output bound: smoke 1,000 tokens; each article 1,000–12,000 tokens, approved in the plan.
- A per-call input-token cap is mandatory. Before dispatch, the complete request's UTF-8 byte length plus 4,096 framing allowance must fit that cap. This intentionally overestimates input rather than using a cheaper guessed token count. Model/tokenizer and provider billing changes can invalidate this assumption; provider account limits remain separate.
- Per-call reserved JPY = ceil-to-cent((input cap × input USD/1M + output cap × output USD/1M) / 1M × USD/JPY × (1 + margin)). Margin must be 10–100%.
- The sum of the approved mode's reservations (one smoke-only reservation or all four full-mode reservations) must fit 700 JPY before any API call. Persistent reservations from prior approvals in either mode count too. A lock serializes ledger updates; a stale lock is HOLD.
- Reservations are never automatically refunded, even on error, unknown usage, timeout, cancellation or process death. Actual usage and costs are recorded when known; they do not free budget for extra calls.
- Prices and FX must be positive, with HTTPS sources and a verification timestamp within seven days. The program validates metadata; it does not independently establish the accuracy of operator-supplied rates. Tests use explicitly fictional rates.

## Stop behavior

Each stage requires a separate exact phrase. Cancel/EOF/Ctrl+C stops. A transport error, HTTP error, timeout, invalid JSON, missing/inconsistent/excess usage, incomplete output or different served model stops. There is no model fallback or regeneration. Any article HOLD/RETRY or failed tamper/period check stops later stages. Seven existing quality gates and their thresholds are unchanged.

Native Node.js 24 runs the worker with `--use-env-proxy`, inherited proxy and CA trust, TLS verification, and redirects rejected. Only the child receives `BOATSTRIKERS_OPENAI_HTTP_KEY` as `OPENAI_API_KEY`. No key or placeholder is placed in argv or files. Unrelated credentials and NODE_OPTIONS are excluded from the child. The source variable is not forwarded.

The dedicated transport now explicitly sends `service_tier: "default"` on every stage and refuses caller-supplied auto/priority/fast/flex/ultrafast modes. It includes that added field in the pre-dispatch byte bound. Actual response service_tier must be exactly default, including on smoke; missing/unexpected values stop the run before any standard-rate cost record. Usage records include the verified serviceTier. The user-supplied standard price plan is $1 input/$5 output per million, 170 JPY/USD, 20% margin: 119.34 JPY reserved. Cached input is quoted at $0.05 but the estimator conservatively uses the full input rate. The historical actualYen field is a configured-rate upper estimate, not a provider invoice or proof of exact billing.

Both modes also require store:false at the transport boundary: omission, true, null and non-boolean values stop before dispatch. The worker constructs explicit private requests from the immutable legacy builders; it never silently corrects an explicit unsafe value. Storage flags do not remove provider safety/abuse-retention obligations. In smoke-only the call guard itself caps requests at one, independently of the worker's early end. Errors/cancellation keep the reservation and consumed approval marker, even when no request was sent.

Official specification evidence: [OpenAI's Responses SDK source](https://github.com/openai/openai-node/blob/master/src/resources/responses/responses.ts) documents that omission defaults to auto, auto follows Project settings (default unless configured otherwise), explicit default uses standard pricing/performance, and the returned mode can differ from the requested mode. Public developer/reference pages returned proxy 403 here; only the official SDK source was directly retrieved. Actual project/model access, balance, credit expiry, budget settings and enforcement cannot be proven by this offline work. A mismatched response can already have incurred cost; detection stops further calls and keeps reservations but cannot retroactively guarantee its price.

For a task that prohibits even local approval issuance/consumption, run only the new transport-tier subset (all fetches are injected mocks; no approval/state files are created):

```sh
node --require ./scripts/blog/verification-offline.cjs --test --test-name-pattern='^tier:' tests/blog/aiVerificationBudget.test.mjs
```

Validation for the initial standard-tier-only task: all 19 tier tests passed without approval issuance/consumption or persistent budget writes; the broader approval regression tests were intentionally not run in that task. In the subsequent save task, dummy-only approval regression testing was explicitly authorized: all 72 tests passed (53 prior tests plus 19 tier tests), zero failures/skips. The standalone three mock articles also pass all seven gates. The committed-snapshot check executes the 63 safety/cost/tier tests in those three files (44 prior tests plus 19 tier tests). No real approval or OpenAI API request is used by these tests.

Output and state paths must be absolute, outside every Git checkout, and not symlink aliases. Reports use new files with mode 0600 in a directory created with mode 0700. They contain only allowlisted metadata and validated article results; raw upstream errors, headers and environment dumps are never saved. Literal, JSON-escaped, URL/base64-encoded supplied credentials and recognizable key/Bearer content are refused before output. This cannot identify every possible encoding of an unknown credential; never insert secrets into plans, source fixtures or articles.

## Free checks

```sh
cd /workspace/boatstrikers-pr295-verification
node --require ./scripts/blog/verification-offline.cjs --test tests/blog/aiVerificationBudget.test.mjs tests/blog/aiLocalVerification.test.mjs tests/blog/aiCostLimits.test.mjs tests/blog/aiVerificationSource.test.mjs tests/blog/aiVerificationSmokeOnly.test.mjs
node --require ./scripts/blog/verification-offline.cjs scripts/blog/verify-real-articles.mjs tests/blog/fixtures/real-data/cases.json
```

The preload removes real credential variables before tests load. Outbound socket connections are denied except loopback; native fetch is denied except the dummy HTTP proxy compatibility probe. Actual OpenAI calls are replaced by in-memory mock responses. Test output/state are temporary external directories and are removed afterwards. Existing installed dependencies can be reused via a local node_modules symlink; no install or lockfile change is necessary.

Validation of this implementation: 35 new safety tests plus 9 existing local-verification/cost tests passed (44 total, no skips). The standalone free mock article command also passed all three characters and seven gates, rejected numeric tampering with HOLD, and returned RETRY when the period was removed. These results do not establish real API credential replacement, model access or billing readiness. No real approval has been issued.

Commit-readiness correction: nine additional source-policy tests bring the full suite to 53 passing tests, zero failures/skips. A disposable local clone commits the complete safety addition and then executes the original 44 tests against that committed snapshot, with 44 passes required (not merely a zero exit status). Other cases cover baseline HEAD, unrelated branches, missing ancestry, unexpected working/index/history changes, changed-then-reverted protected code, assume-unchanged, and attempts to override the policy through a plan or stale approval. No user checkout is committed/reset by these tests, and no remote or OpenAI API is contacted.
