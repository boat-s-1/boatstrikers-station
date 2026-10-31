# PHASE14 — approved old Preview deletion result

**Single-deployment deletion: PASS. Overall production decision: HOLD. PR294 stays Draft.**

The user approved deleting only `dpl_2gLUhD5r39bDkzb1D7Lerk8p8buX`, then requested continuation. The individual Vercel UI deletion was performed on2026-11-01 JST. No other deployment or credential was deleted or changed.

## Before the destructive action

The management API and UI agreed on project `prj_iKWrqS29BRLCIWKHoDe1SFOTH8Y2` (boatstrikers-station), Preview target, branch `feature/gamagori-chart-collector`, source commit `65e134cd937d7dd37e5f95acd547dfe86f7a8d03`, and URL `https://boatstrikers-station-7dajpkr6q-boat-s-1s-projects.vercel.app`. The exact candidate was READY/Stale; live aliases were empty. The historical Domains display was not used as current routing evidence.

Production domain mapping and current branch mapping were recorded immediately before execution. The original75 variables were recorded as metadata only, with no decrypted values; the temporary3 variables were absent. Only the candidate's Deployment Actions > Delete confirmation was submitted. No project-wide operation, promotion, rollback, alias edit, environment edit, Protection change or bypass issuance occurred.

## Deletion evidence

- Same-team GET of the candidate ID: **404, Deployment not found**. This is the expected verification result, not a failed collector test.
- Vercel management page for the same ID: **404 / This page doesn't exist**. [Screenshot](gamagori-phase14-retirement/deleted.jpg).
- Cookie-free, redirect-disabled GET of the old deployment URL: **404**, `x-vercel-error=DEPLOYMENT_NOT_FOUND`; matching error body; no redirect. This is distinct from the old SSO302 and proves the URL no longer serves that deployment.

The old snapshot is no longer available as an active Vercel deployment or instant rollback target. This is not an assertion of physical erasure of provider backups or revocation of every credential copy.

## Preservation checks, before and after deletion

| Item | Result |
| --- | --- |
| boat-strike.online and www.boat-strike.online | Both still point to dpl_KEiMTsfy7emuXmdpfK5tsby3GhA5 |
| Current PR294 branch alias | Still points to dpl_5NtSmQ143zcjuqMmS1Dw2g34Lt3B |
| Original environment variables | 75; exact id/key/target/gitBranch/type/updatedAt metadata unchanged |
| Temporary isolated-DB variables | 0 |
| Production charts, read-only SQL | 198 races /1,188boats; duplicate keys0; incomplete races0 |
| PR294 before evidence publication | Draft=true; open; HEAD7e3e716 |

The evidence-only commit may trigger the normal credential-free Preview build and move its own branch alias afterward. The table above records the direct deletion's before/after window, before publishing this report. Production, other branches, keys, Cron, TRINITY/news/prediction code and database contents were not modified by this task. No new collection was executed and no row was saved.

## Remaining HOLD — outside this approval

The existing isolated legacy service_role key itself was not revoked, rotated or tested for invalidity. Deleting this deployment removes this active deployment copy; it does not invalidate an independently usable Supabase credential. The isolated legacy-pair and previous-HS256 retirement plan still requires dependency verification (including its two inherited news/media Edge Functions) and separate approval. No production/shared key changes are allowed.

The existing Collector Bearer value is still unavailable through a verified approved authentication flow. Authenticated Preview-to-isolated-DB attestation, six-boat normal save, repeat insertion0, overlapping HTTP requests, live official sale/roster/chart matching and authenticated runtime stop after removing configuration remain unverified. No PASS credit is assigned to those items.

Previous162 local passing cases and SQL36 are inherited results; this documentation/deployment-cleanup task does not add fictitious regression-test counts.
