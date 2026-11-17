# PR298 — official provider schema documentation review (2026-11-17)

Source: https://github.com/boatraceopenapi/api/blob/gh-pages/docs/v1/schema.md
and https://boatraceopenapi.github.io/ (provider's own documentation).
This is **documentation comparison**, not a downloaded real payload or permission grant.

## Important discrepancy requiring HOLD

Provider's documented JSON nesting is
`programs.stadiums.{stadium_number}.races.{race_number}`.
The documented `stadium_number` field is shown **inside each race**
object. Current SQL candidate
`openapi-atomic-cron-caller.candidate.sql` validates
`sv->>'stadium_number' IS DISTINCT FROM sk` where `sv` is the
stadium container, and synthetic fixtures insert `stadium_number`
at the stadium container level. This may cause valid provider
documents to be rejected. Do not deploy until the actual payload
is checked and fixtures are aligned with documented nesting.

Provider describes the file as nonofficial, refreshed approximately
every 10 minutes with possible 10–20-minute latency, incomplete
data and no correctness guarantee. The historical file can be
recollected after midnight; historical preview may not reflect the
original pre-race snapshot. Therefore historical replay must not
masquerade as pre-race evidence for TRINITY.

## Safe next steps

1. Obtain a real time-stamped permitted JSON sample via a
   read-only retrieval and inspect stadium and race keys; record
   hashes and structural summary without unnecessary personal data.
2. Correct candidate SQL and synthetic fixtures together; add
   a provider-shaped fixture that omits stadium-container
   `stadium_number`, asserts race-level `stadium_number`,
   and rejects mismatches.
3. Rerun both CI workflows and ensure no partial write.
4. Independently resolve data rights and production parity before cutover.

**HOLD**. No production writes, Cron changes, deployments or paid branch.
