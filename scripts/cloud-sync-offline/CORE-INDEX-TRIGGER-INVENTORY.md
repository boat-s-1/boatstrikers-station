# Core table index and trigger inventory

Production pg_catalog SELECT, 2026-11-17. Review reference only; dependent functions and table baseline remain incomplete. Do not execute against production.

## index: bs_race_entries.bs_race_entries_api_key

```sql
CREATE UNIQUE INDEX bs_race_entries_api_key ON public.bs_race_entries USING btree (race_date, course_code, race_no, boat_no);
```

## index: bs_race_entries.bs_race_entries_date_course_idx

```sql
CREATE INDEX bs_race_entries_date_course_idx ON public.bs_race_entries USING btree (race_date, course_code, race_no, boat_no);
```

## index: bs_race_entries.bs_race_entries_engine_key

```sql
CREATE UNIQUE INDEX bs_race_entries_engine_key ON public.bs_race_entries USING btree (race_date, course_code, race_no, boat_no);
```

## index: bs_race_entries.bs_race_entries_pkey

```sql
CREATE UNIQUE INDEX bs_race_entries_pkey ON public.bs_race_entries USING btree (id);
```

## index: bs_race_entries.bs_race_entries_racer_idx

```sql
CREATE INDEX bs_race_entries_racer_idx ON public.bs_race_entries USING btree (racer_registration_no, race_date DESC);
```

## index: bs_race_entries.bs_race_entries_unique

```sql
CREATE UNIQUE INDEX bs_race_entries_unique ON public.bs_race_entries USING btree (race_date, course_code, race_no, boat_no);
```

## index: bs_race_entries.idx_bs_entries_exhibition_fl_v10

```sql
CREATE INDEX idx_bs_entries_exhibition_fl_v10 ON public.bs_race_entries USING btree (race_date, course_code, race_no, exhibition_fl) WHERE (exhibition_fl IS NOT NULL);
```

## index: bs_race_entries.idx_bs_entries_official_exhibition_v7

```sql
CREATE INDEX idx_bs_entries_official_exhibition_v7 ON public.bs_race_entries USING btree (race_date, course_code, race_no) WHERE (official_exhibition_time IS NOT NULL);
```

## index: bs_race_entries.idx_bs_race_entries_ai_v16

```sql
CREATE INDEX idx_bs_race_entries_ai_v16 ON public.bs_race_entries USING btree (race_date, course_code, race_no, boat_no);
```

## index: bs_race_entries.idx_bs_race_entries_racer_registration

```sql
CREATE INDEX idx_bs_race_entries_racer_registration ON public.bs_race_entries USING btree (racer_registration_no);
```

## index: bs_race_events.bs_race_events_api_key

```sql
CREATE UNIQUE INDEX bs_race_events_api_key ON public.bs_race_events USING btree (race_date, course_code, race_no);
```

## index: bs_race_events.bs_race_events_date_course_idx

```sql
CREATE INDEX bs_race_events_date_course_idx ON public.bs_race_events USING btree (race_date, course_code, race_no);
```

## index: bs_race_events.bs_race_events_engine_key

```sql
CREATE UNIQUE INDEX bs_race_events_engine_key ON public.bs_race_events USING btree (race_date, course_code, race_no);
```

## index: bs_race_events.bs_race_events_pkey

```sql
CREATE UNIQUE INDEX bs_race_events_pkey ON public.bs_race_events USING btree (id);
```

## index: bs_race_events.bs_race_events_race_unique

```sql
CREATE UNIQUE INDEX bs_race_events_race_unique ON public.bs_race_events USING btree (race_date, course_code, race_no);
```

## index: bs_race_events.bs_race_events_unique

```sql
CREATE UNIQUE INDEX bs_race_events_unique ON public.bs_race_events USING btree (race_date, course_code, race_no);
```

## index: bs_race_results.bs_race_results_pkey

```sql
CREATE UNIQUE INDEX bs_race_results_pkey ON public.bs_race_results USING btree (id);
```

## index: bs_race_results.bs_race_results_race_date_course_code_race_no_key

```sql
CREATE UNIQUE INDEX bs_race_results_race_date_course_code_race_no_key ON public.bs_race_results USING btree (race_date, course_code, race_no);
```

## index: bs_race_results.idx_bs_results_race

```sql
CREATE INDEX idx_bs_results_race ON public.bs_race_results USING btree (race_date, course_code, race_no);
```

## trigger: bs_race_entries.bs_race_entries_exhibition_guard

```sql
CREATE TRIGGER bs_race_entries_exhibition_guard BEFORE INSERT OR UPDATE ON public.bs_race_entries FOR EACH ROW EXECUTE FUNCTION bs_guard_exhibition_write();
```

## trigger: bs_race_entries.bs_race_entries_set_updated_at

```sql
CREATE TRIGGER bs_race_entries_set_updated_at BEFORE UPDATE ON public.bs_race_entries FOR EACH ROW EXECUTE FUNCTION bs_set_updated_at();
```

## trigger: bs_race_entries.trg_bs_reconcile_bootstrap_entry

```sql
CREATE TRIGGER trg_bs_reconcile_bootstrap_entry BEFORE UPDATE ON public.bs_race_entries FOR EACH ROW EXECUTE FUNCTION bs_reconcile_bootstrap_entry();
```

## trigger: bs_race_entries.trg_bs_reconcile_bootstrap_event_after_entry

```sql
CREATE TRIGGER trg_bs_reconcile_bootstrap_event_after_entry AFTER UPDATE ON public.bs_race_entries FOR EACH ROW EXECUTE FUNCTION bs_reconcile_bootstrap_event_after_entry();
```

## trigger: bs_race_entries.trg_bs_track_entry_first_seen

```sql
CREATE TRIGGER trg_bs_track_entry_first_seen AFTER INSERT OR UPDATE ON public.bs_race_entries FOR EACH ROW EXECUTE FUNCTION bs_track_entry_first_seen();
```

## trigger: bs_race_entries.trg_ichika_escape_surge_on_exhibition_update

```sql
CREATE TRIGGER trg_ichika_escape_surge_on_exhibition_update AFTER INSERT OR UPDATE OF official_exhibition_time, exhibition_time, official_lap, lap_time ON public.bs_race_entries FOR EACH ROW EXECUTE FUNCTION trigger_evaluate_ichika_escape_surge_alerts();
```

## trigger: bs_race_events.bs_race_events_set_updated_at

```sql
CREATE TRIGGER bs_race_events_set_updated_at BEFORE UPDATE ON public.bs_race_events FOR EACH ROW EXECUTE FUNCTION bs_set_updated_at();
```

## trigger: bs_race_events.trg_settle_theory_recommendations

```sql
CREATE TRIGGER trg_settle_theory_recommendations AFTER INSERT OR UPDATE OF trifecta, trifecta_payout ON public.bs_race_events FOR EACH ROW EXECUTE FUNCTION bs_settle_theory_recommendations_from_event();
```

## trigger: bs_race_results.trg_bs_track_result_first_seen

```sql
CREATE TRIGGER trg_bs_track_result_first_seen AFTER INSERT OR UPDATE ON public.bs_race_results FOR EACH ROW EXECUTE FUNCTION bs_track_result_first_seen();
```
