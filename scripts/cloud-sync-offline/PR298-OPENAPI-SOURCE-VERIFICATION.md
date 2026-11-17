# PR298 — External OpenAPI source verification (2026-11-17)

**Status: HOLD — payload schema and data rights not yet proven.**

## Observed public evidence
- Public project: https://github.com/boatraceopenapi/boatraceopenapi.github.io
- The repository README describes the project as an API published with
  GitHub Actions and GitHub Pages and labels the **repository** MIT-licensed.
- Production `bs_sync_openapi_today()` fetches
  `https://boatraceopenapi.github.io/api/v1/today.json`.
- Public fetch of the actual JSON did **not** yield a verified, inspectable
  current payload in this review environment. Do not claim registration
  parity, program completeness or current endpoint health from this check.

## Critical distinction
An MIT license for repository software does not by itself establish that
third-party race-program content may be collected, retained, republished or
commercially redistributed. Obtain source-data terms or direct permission
before treating this as an authorized production replacement.

## Minimum payload validation (read-only, permitted source access only)
1. Record fetch time (JST), HTTP status, Content-Type, SHA-256 of raw response,
   and source URL. Do not log credentials or personal secrets.
2. Inspect `programs.stadiums`, stadium code, race number, race date and
   **program racer objects**; do not confuse preview/result racers with
   pre-race registration identities.
3. Require exactly six boats per included race, unique boat numbers 1–6,
   unique valid racer registrations, and no unexpected duplicate race keys.
4. Compare complete race-key set to an authoritative official schedule;
   an endpoint's own count is not independent proof of completeness.
5. Verify licensing and permitted polling cadence; avoid repeated or
   aggressive network probes.
6. Capture a sanitized, permitted sample for isolated parser and atomic RPC
   testing. No production writer calls in this step.

**Decision:** No source-backed current-day bootstrap parser or production
Cron change is approved from this evidence alone.
