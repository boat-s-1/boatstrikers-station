# Ichika-only — implementation/free mocks, no paid execution approval

Use the verification checkout only. Keep the existing smoke report, its used approval, and the real 21.42 JPY ledger reservation untouched. No actual article, approval or new real reservation is created by this task. All tests use dummy credentials and disposable external directories.

## Mode and plan

`mode:ichika-only` calls the Responses article schema once, never smoke, Hatsune, Kiina or the four-stage runner. It keeps the original Ichika prompt/persona, distinction between boat number and entry course, facts-only rules, period/source requirements, SEO instructions and all seven existing gates unchanged. PASS is a local evaluation result, NOT publication permission. No database write, cover generation, publish/schedule function or extra AI call is invoked.

Start with the smoke-only plan schema, but use:

```json
{
  "mode": "ichika-only",
  "model": "gpt-6.1-terra",
  "serviceTier": "default",
  "store": false,
  "budgetYen": 1000,
  "limitYen": 700,
  "margin": 0.2,
  "inputTokens": 100000,
  "outputTokens": 12000,
  "inputUsdPerMillion": 1,
  "outputUsdPerMillion": 5,
  "usdJpy": 170,
  "pricingSource": "https://developers.openai.com/api/docs/models/gpt-6.1-terra",
  "fxSource": "https://www.boj.or.jp/statistics/market/forex/fxdaily/index.htm",
  "ratesVerifiedAt": null,
  "output": "/workspace/boatstrikers-ai-results/CHOOSE-A-NEW-ICHIKA-RUN",
  "stateDir": "/workspace/boatstrikers-ai-verification-state",
  "maxCalls": 1,
  "caseKey": "ichika-kiryu-inside",
  "inputDataHash": null,
  "snapshotPath": "/workspace/boatstrikers-ai-snapshots/CHOOSE-A-REAL-PUBLISHED-SNAPSHOT.json",
  "snapshotHash": null
}
```

Nulls deliberately keep this template HOLD. FX 170 is a user budgeting assumption, not an official market quote. Do not update verification timestamps without reviewing provenance. inputDataHash is calculated from the immutable cases manifest plus full stored export bytes; the source fingerprint binds prompts, persona, validators and fixture bytes too. The input helper verifies Kiryu 2026-10-04 through 2026-10-26, population168/usable166/course_missing2/escapes73/rate44.0. It does not reinterpret this as current predictions or odds.

Only 32.64 JPY is newly reserved. With the preserved smoke 21.42 JPY, expected cumulative reservation is 54.06 JPY and remaining local room is 645.94 JPY. The program reads the actual shared ledger, not these illustrative totals. No refunds or retries occur on failure or unknown usage. Old approvals cannot be converted to this mode.

Version-3 approvals bind mode, HEAD, source digest, full plan, fixed input hash/dataset hash and snapshot path/file hash/provenance/time/count. Snapshot/input checks happen before approval, after its interactive prompt, before consumption/reservation, immediately before dispatch after the stage prompt, and after the response. Changing the snapshot or plan invalidates the approval. Prior version-2 smoke/full approvals remain format-compatible for those modes only; the existing used smoke record is never modified.

## Real published-blog snapshot is a prerequisite, not a mock success

The snapshot is a local JSON outside Git, at most 32 MiB, with complete public published/sealed title+body records, source URL, query version, capture time, count and canonical content hash. The plan separately pins SHA-256 of the exact file bytes. A missing, stale (>24 hours), future-dated, empty, truncated, tampered, malformed or wrong-source snapshot is HOLD before API use. An empty inventory needs separate authoritative verification; this mode conservatively refuses it. Digest checks prove local consistency and approval binding, not that an operator-authored file is truthful. Review provenance from the actual capture; never pass off the mock-test source as production.

The comparison covers the inventory as of capture time, not articles published afterwards. Refresh close to execution; do not silently refresh the same approved file. A replacement requires a new bound plan and separately authorized approval.

The implemented capture path uses ONLY SELECT with the app's BLOG-specific anon/RLS credentials. It pages posts, sealed published revisions and body blocks with exact counts, and requires matching complete publication inventories before/after capture. It never falls back to race DB or service-role credentials. RLS must permit public reads of blog_posts, blog_post_revisions and blog_blocks; TLS/proxy and the BLOG project's HTTPS hostname must be permitted. The API key must be supplied through secure existing environment bindings, never CLI arguments or chat.

For a later separately authorized read-only capture (not run by this task):

```sh
node --use-env-proxy scripts/blog/verification-snapshot.mjs capture /absolute/external/published-snapshot.json
```

It needs BLOG_SUPABASE_URL and BLOG_SUPABASE_ANON_KEY; both are currently absent here. The public blog URL https://www.boat-strike.online/blog returned proxy CONNECT403, so no real published snapshot has been captured or checked. Read-only client mocks test pagination/integrity/failures only. Actual existing-blog comparison remains HOLD until a genuine complete snapshot is captured with permissions and provenance reviewed.

Existing duplicateFindings compares titles and full body text locally, without an embedding/API request. Its findings feed the original duplicates gate. Known numeric tampering and period-removal evaluations also use the same original validator/gates. A failure is saved locally as HOLD with no regeneration. The local cover identifier is a validation placeholder, not a real publishing-ready media asset.

## Free tests

Run the original five-file 106-test suite plus `tests/blog/aiVerificationIchikaOnly.test.mjs` under `--require ./scripts/blog/verification-offline.cjs`. Real credential variables are removed, network requests are denied, and mock approval/budget/output/snapshot directories are cleaned afterward. Do not run real preflight/approve/run against the real stateDir in this task.

Validation: 38 new Ichika/snapshot tests plus the existing 106 tests passed together (144 passed, zero failures/skips). The existing real smoke artifacts are independently hashed before/after testing and remain unchanged. No genuine published snapshot, real approval, real reservation or article is created by this implementation.
