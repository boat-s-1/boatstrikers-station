# Schema-only recovery gate — production read-only evidence (2026-11-16)

## Verified core catalog inventory

| Table | Columns | Constraints | Non-internal triggers | Indexes | RLS |
|---|---:|---:|---:|---:|---|
| bs_race_events | 56 | 6 | 2 | 6 | enabled |
| bs_race_entries | 107 | 7 | 6 | 10 | enabled |
| bs_race_results | 18 | 2 | 1 | 3 | enabled |

This inventory comes from `pg_class`, `pg_attribute`, `pg_constraint`, `pg_trigger`, `pg_index` using SELECT only on production.

The three tables alone have **181 columns, 15 constraints, 9 triggers, and 19 indexes**. This is an *inventory*, not a reconstructed executable schema. Functions called by triggers and external referenced relations add further dependencies.

## Reproducible read-only inventory query

```sql
WITH core AS (
 SELECT c.oid,c.relname
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public'
 AND c.relname IN ('bs_race_events','bs_race_entries','bs_race_results')
)
SELECT core.relname,
 (SELECT count(*) FROM pg_attribute a
  WHERE a.attrelid=core.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
 (SELECT count(*) FROM pg_constraint x WHERE x.conrelid=core.oid) AS constraints,
 (SELECT count(*) FROM pg_trigger t
  WHERE t.tgrelid=core.oid AND NOT t.tgisinternal) AS triggers,
 (SELECT count(*) FROM pg_index i WHERE i.indrelid=core.oid) AS indexes,
 (SELECT relrowsecurity FROM pg_class WHERE oid=core.oid) AS rls_enabled
FROM core ORDER BY core.relname;
```

## Gate for a replacement isolated environment

1. Validate the **full production schema baseline**, including referenced tables, functions, triggers, permissions and RLS, before provisioning a paid branch.
2. After schema load, run the same query on isolation and compare *object definitions*, not just counts.
3. Confirm `bs_apply_openapi_bootstrap` function signature and the exact implementation hash in isolation.
4. Confirm trigger side effects and guard against current-JST-date alert generation.
5. Use a deliberately limited 1-race / 6-boat fixture to check insert, repeat no-op, partial recovery, and transaction rollback; do not use a production connection.
6. Only then exercise the complete 600-race archive in isolation.
7. Do not use historical post-race archives as proof of pre-race feature snapshots.
8. Obtain explicit approval before production backfill.

## Test status
The 36 offline Node tests passed locally (36/36). They do **not** validate PostgreSQL insert semantics or triggers.

## Scope and cost
No new branch created in this phase. The prior user-approved branch was deleted, and its absence was verified.
