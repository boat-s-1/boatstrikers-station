# Smoke-only mode — implementation and free tests, not execution approval

Use only `/workspace/boatstrikers-pr295-verification` on the dedicated verification branch. Nothing in this document authorizes a real request. This is separate from the existing four-stage mode, which remains backward compatible. No OpenAI request, real approval, GitHub update or production change is performed by this implementation task.

## Exact plan schema

```json
{
  "mode": "smoke-only",
  "model": "gpt-6.1-terra",
  "serviceTier": "default",
  "store": false,
  "budgetYen": 1000,
  "limitYen": 700,
  "margin": 0.2,
  "inputTokens": 100000,
  "outputTokens": 1000,
  "inputUsdPerMillion": 1,
  "outputUsdPerMillion": 5,
  "usdJpy": 170,
  "pricingSource": "https://developers.openai.com/api/docs/models/gpt-6.1-terra",
  "fxSource": "https://www.boj.or.jp/statistics/market/forex/fxdaily/index.htm",
  "ratesVerifiedAt": null,
  "output": "/workspace/boatstrikers-ai-results/CHOOSE-A-NEW-SMOKE-RUN",
  "stateDir": "/workspace/boatstrikers-ai-verification-state",
  "maxCalls": 1
}
```

The null timestamp intentionally keeps this template HOLD. Rates are user-supplied standard-model prices. FX 170 is a fixed budgeting assumption, not a claimed BOJ quote; the link is a reference, and provenance must be reviewed honestly. `budgetYen:1000` is the historical overall reference; the enforced cumulative local cap is `limitYen:700`. All smoke-only numeric fields, mode, model, serviceTier and store are fixed and validated. No article-output field or extra override field is accepted.

Only 21.42 JPY is reserved: (100,000 × $1 + 1,000 × $5)/1,000,000 × 170 × 1.2. Output includes reasoning tokens. Cached-input discount is not assumed. The SAME persistent stateDir counts old and new four-stage/smoke reservations together against 700 JPY. Reservation never refunds itself after cancellation, error or unknown usage; a stale budget lock/state is HOLD. It never reserves the four-stage 119.34 JPY for a smoke-only plan.

## Approval and execution boundary

The normal offline preflight/approve/run CLI uses the plan's explicit mode. Do not run approve/run until separately authorized. An external plan filename and a non-secret approval ID are the only worker arguments. The parent passes the HTTP-secret placeholder as child-only OPENAI_API_KEY and enables Node24 proxy support. No credential is placed in argv or files.

Version-2 approvals bind mode, fixed base, current HEAD, source digest, full plan fingerprint, model, budget, state/output paths and the one allowed stage. The approval phrase displays mode, HEAD, source digest, one call and 21.42 JPY. Approval is one-use, expires in one hour, and is consumed atomically BEFORE reservation and any request. Missing/invalid/expired/mismatched/replayed approvals stop before dispatch. Old approval formats are invalid; changing code, committing, changing mode or changing output invalidates an approval. The source is rechecked after the human approval prompt. No real approval is issued by tests.

Every guarded request must contain `store:false` before dispatch; absent/true/null/string values stop. The immutable legacy builders are adapted in the worker to explicitly construct store:false requests before they reach that guard. Explicit unsafe values are not silently corrected. All four-stage requests use the same privacy guard too.

Smoke success writes a private external report and ENDS. It does not call the article verifier, compute article prompts or request any article-stage confirmation. The transport independently refuses a second request. The report includes mode, HEAD, verified default tier, known usage and reserved JPY, but no credential/request headers/raw errors. Missing usage, incomplete output, wrong served model/tier, HTTP/network errors and the 30-second maximum smoke timeout stop without retry. A response mismatch may already have incurred cost; it cannot be retroactively unbilled. `store:false` is an API storage control, not a guarantee of zero provider safety/abuse retention.

## Free verification only

```sh
node --require ./scripts/blog/verification-offline.cjs --test tests/blog/aiVerificationBudget.test.mjs tests/blog/aiLocalVerification.test.mjs tests/blog/aiCostLimits.test.mjs tests/blog/aiVerificationSource.test.mjs tests/blog/aiVerificationSmokeOnly.test.mjs
```

The preload strips real credential variables. Only dummy fetch responses and temporary mock approval/budget/output directories are used; they are removed after tests. The original four-file 72-test suite remains separate and must pass unchanged in coverage. No real state directory is initialized, no execution plan is deployed, no approval is issued for actual use, and no real API call is allowed here.

Validation: 34 new smoke-only/compatibility tests and the existing 72 tests passed together (106 passed, zero failed/cancelled/skipped). Coverage includes one-call success with no article verifier results, second-call refusal, exact reservation, shared old/full-mode budget, absent/tampered/reused/cross-mode approvals, privacy flags, errors/timeouts/unknown usage, and full-mode four-call/seven-gate compatibility. The source-policy regression also commits a disposable local fixture and verifies its existing 63-test subset; neither user checkout is committed or reset.
