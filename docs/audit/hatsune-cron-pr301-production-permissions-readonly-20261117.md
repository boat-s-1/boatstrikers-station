# PR #301 — production permissions read-only verification (2026-11-17)

## Scope
No production write, API mutation, Cron trigger, branch creation or deploy. Queried only PostgreSQL catalogs for `public.hatsune_news_cron_runs` in production project `rzosrbkyniyedolhkgxo`.

## Observations
- `relrowsecurity=true`, `relforcerowsecurity=false`.
- `has_table_privilege('service_role', table_oid, 'UPDATE')=true`.
- `has_table_privilege('service_role', table_oid, 'SELECT')=true`.
- `has_table_privilege('anon', table_oid, 'UPDATE')=false`.
- `has_table_privilege('authenticated', table_oid, 'UPDATE')=false`.
- Supabase JavaScript documentation: `select()` after `update()` returns modified rows; `maybeSingle()` allows zero or one returned row.
  - https://supabase.com/docs/reference/javascript/using-modifiers-select
  - https://supabase.com/docs/reference/javascript/using-modifiers-maybesingle

## Interpretation
The service role has the table-level SELECT and UPDATE permissions required for `update(...).eq(...).select('id').maybeSingle()`. This is not an end-to-end PostgREST request and does not prove runtime credentials, API exposure, or network access.

## Release gate
Draft/HOLD until safe isolated API integration test and reviewer approval. No production replay of prior running/partial jobs. The general-news BOAT RACE source timeout remains a separate issue.
