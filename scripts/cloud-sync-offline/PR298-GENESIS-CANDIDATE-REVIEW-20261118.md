# PR298 — Repository genesis candidates inspected (2026-11-18)

**Evidence only. DO NOT deploy either candidate to production or replay as a migration.**

## CI evidence

At commit `bd44114011c003f5ca9533bbebb76c1115161051`, both workflows passed: PostgreSQL fixture run #341 (`44152464225`) and offline contract #346 (`44152464302`). Job `134284198246` printed the offline inventory over **142 SQL files**. Each of the three core tables has **four** direct CREATE TABLE matches:

1. `scripts/cloud-sync-offline/CORE-TABLES-REVIEW-DRAFT.sql`
2. `scripts/cloud-sync-offline/SIX-TABLE-ISOLATION-CANDIDATE.sql`
3. `scripts/cloud-sync-offline/completeness-v3-postgres-fixture.setup.sql`
4. `scripts/cloud-sync-offline/openapi-captured-bootstrap.test.sql`

The last two are test fixtures, not authoritative schema genesis.

## Candidate inspection

- `CORE-TABLES-REVIEW-DRAFT.sql` explicitly states it is **REVIEW DRAFT ONLY**, extracted from production pg_catalog, and omits constraints, indexes, triggers, functions, RLS, ACL, and related tables. Not replay-ready.
- `SIX-TABLE-ISOLATION-CANDIDATE.sql` explicitly states **ISOLATION ONLY**, assembled from production catalog on 2026-11-17, no data copied, not for production. It contains six CREATE TABLE statements, ten CREATE TRIGGER statements, six RLS enable statements, six CREATE POLICY statements, and a transaction wrapper.
- **Security concern to resolve before using even in a disposable realistic test:** this candidate contains `GRANT ALL ON TABLE public.bs_race_events TO anon, authenticated, service_role` and analogous grants on the other five tables. `GRANT ALL` can grant write privileges to untrusted roles, even if RLS currently limits writes. This does **not** demonstrate privilege parity or safe API exposure; use exact read-only catalog comparisons and least-privilege fixture roles. Do not assume it matches production grants.
- The candidate's own provenance is a snapshot from 2026-11-17, **not** the original schema at the start of the August migration sequence. Running all historical migrations on top of a present-day schema may duplicate objects, alter behavior, or fail. It is not a proven genesis baseline.

## Next safe work

1. Compare candidate definitions with production catalog (including all columns, constraints, indexes, RLS, grants, functions and triggers), explicitly separating production-current parity from historical genesis.
2. Identify historical schema baseline, archive, backup, or original bootstrap commit. Check if the repository's actual migration history is a partial capture of a pre-existing production schema.
3. Keep full replay and production cutover blocked until an accurate, version-appropriate baseline is found and isolated tests pass.
4. No new paid branch without approval; preserve PR Draft/HOLD and production DB/Cron unchanged.
