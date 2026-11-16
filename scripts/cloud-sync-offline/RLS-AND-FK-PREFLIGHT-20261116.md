# Six-table RLS and foreign-key preflight — 2026-11-16

Read-only production `pg_catalog` inspection.

| Table | RLS enabled | Policy count | Policy command |
|---|---|---:|---|
| bs_race_events | yes | 2 | SELECT only |
| bs_race_entries | yes | 2 | SELECT only |
| bs_race_results | yes | 2 | SELECT only |
| bs_source_first_seen | yes | 0 | none |
| bs_ichika_escape_surge_alerts | yes | 0 | none |
| bs_theory_recommendations | yes | 0 | none |

Policy absence with RLS enabled means ordinary role access is denied by default absent bypass privileges. Actual access also depends on GRANTs, ownership and SECURITY DEFINER call chains. Do not infer that the three private tables are writable by `anon` or `authenticated`.

Foreign-key inspection found exactly **one outgoing FK among the six target tables**: `bs_race_entries(race_date,course_code,race_no)` references `bs_race_events` on DELETE CASCADE. This does not exclude incoming FKs from other tables, which must be checked separately before any schema recreation or deletion.

## Safety conclusions
- No public INSERT/UPDATE/DELETE RLS policies were found on these six tables.
- The bootstrap RPC and theory capture/settlement functions are SECURITY DEFINER; audit their EXECUTE grants before exposing any cloud write endpoint.
- Schema comparison must include policies, grants, function owners and SECURITY DEFINER flags.
- Production remains read-only. No new paid branch created.

## Read-only SQL
```sql
SELECT c.relname AS table_name,count(p.oid) AS policy_count,
       coalesce(string_agg(p.polname||':'||p.polcmd::text,', ' ORDER BY p.polname),'(none)') AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid=c.oid
WHERE n.nspname='public'
AND c.relname IN ('bs_race_events','bs_race_entries','bs_race_results',
                  'bs_source_first_seen','bs_ichika_escape_surge_alerts',
                  'bs_theory_recommendations')
GROUP BY c.relname ORDER BY c.relname;
```
