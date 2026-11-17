# Recovered bs_set_updated_at function — 2026-11-18

Source: read-only `pg_get_functiondef`, `pg_proc`, and `pg_get_triggerdef` from production PostgreSQL catalog. This captures **current** production definition, not proven historical migration-zero state. **Non-executable audit document only**.

```sql
CREATE OR REPLACE FUNCTION public.bs_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
```

- Arguments: none. Return type: trigger. Volatility: volatile. Security definer: false (invoker). Language: plpgsql.
- Function name absent from 133 registered migration statement arrays under literal name scan.
- **Six** current triggers invoke it (all `BEFORE UPDATE FOR EACH ROW`): `bs_ai_predictions_set_updated_at`, `bs_entries_set_updated_at`, `bs_events_set_updated_at`, `bs_race_entries_set_updated_at`, `bs_race_events_set_updated_at`, `bs_results_set_updated_at`.
- Three additional tables `bs_entries`, `bs_events`, `bs_results` emerged beyond the previous five-table trigger scope. Their baseline creation provenance must also be assessed.
- Do not automatically apply this function or triggers to a branch or production. Verify historical chronology and permissions first.
