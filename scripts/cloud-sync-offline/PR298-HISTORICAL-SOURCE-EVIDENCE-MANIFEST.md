# PR298 Historical source evidence manifest — template (no source approved)

This file is intentionally **empty of real source claims**. Populate only from
independently verified archive records. Do not infer a source from result rows,
from a current-day endpoint, or from the presence of a file with a familiar name.

## Required evidence per immutable archive file

| Field | Required evidence |
|---|---|
| source_id | Locally assigned stable identifier |
| provider | Official archive owner and operator |
| original_url | Exact archive download URL, not a home page |
| race_date_jst | YYYY-MM-DD; approved candidate window only |
| captured_at_utc | Actual capture timestamp with timezone; may precede race day |
| sha256 | SHA-256 of original bytes, not transformed JSON |
| format | Raw MIME/type and schema version |
| rights_evidence | Written permission/license URL or documented provider terms |
| rights_scope | Explicit collection, retention, processing and redistribution rights |
| course_codes | Exact race venues covered |
| race_keys | Exact course_code/race_no pairs verified in file |
| six_boat_verified | Each race has boats 1–6 and unique racer registrations |
| transformations | Reproducible parser version and resulting JSON SHA-256 |
| reviewer | Human who verified authenticity and source permission |
| approval | Explicit per-file GO/HOLD and date of approval |

## Stop conditions

- No archive or unverifiable SHA-256: HOLD
- Unclear rights for the intended production use: HOLD
- Program data reconstructed from results or predictions: HOLD
- Missing, duplicate, mismatched or conflicting boats: HOLD
- Archive race keys outside the freshly computed production allowlist: HOLD
- Any mutation to production, Cron or Vercel before explicit approval: HOLD

## Initial state

**0 source files verified; 0 race keys source-approved.** The 732 structurally
eligible production result-only races identified on 2026-11-17 are **not**
source-approved by this manifest.

After source approval, intersect each file's exact race keys with the
read-only production preflight output. Never authorize an entire date or
venue solely because one race was verified.
