# Index creation order for isolated schema

Read from production pg_catalog on 2026-11-17. Create primary/unique constraints first; PostgreSQL creates their owned indexes. Create only the standalone indexes separately. This is a review inventory, not an executable migration.

| Table | Index | Origin |
|---|---|---|
| bs_ichika_escape_surge_alerts | bs_ichika_escape_surge_alerts_pkey | constraint bs_ichika_escape_surge_alerts_pkey |
| bs_ichika_escape_surge_alerts | bs_ichika_escape_surge_alerts_race_date_course_code_race_no_key | constraint bs_ichika_escape_surge_alerts_race_date_course_code_race_no_key |
| bs_ichika_escape_surge_alerts | bs_ichika_escape_surge_alerts_race_date_idx | standalone |
| bs_ichika_escape_surge_alerts | idx_bs_ichika_escape_surge_alerts_pending | standalone |
| bs_race_entries | bs_race_entries_api_key | standalone |
| bs_race_entries | bs_race_entries_date_course_idx | standalone |
| bs_race_entries | bs_race_entries_engine_key | standalone |
| bs_race_entries | bs_race_entries_pkey | constraint bs_race_entries_pkey |
| bs_race_entries | bs_race_entries_racer_idx | standalone |
| bs_race_entries | bs_race_entries_unique | constraint bs_race_entries_unique |
| bs_race_entries | idx_bs_entries_exhibition_fl_v10 | standalone |
| bs_race_entries | idx_bs_entries_official_exhibition_v7 | standalone |
| bs_race_entries | idx_bs_race_entries_ai_v16 | standalone |
| bs_race_entries | idx_bs_race_entries_racer_registration | standalone |
| bs_race_events | bs_race_events_api_key | standalone |
| bs_race_events | bs_race_events_date_course_idx | standalone |
| bs_race_events | bs_race_events_engine_key | standalone |
| bs_race_events | bs_race_events_pkey | constraint bs_race_events_pkey |
| bs_race_events | bs_race_events_race_unique | constraint bs_race_events_race_unique |
| bs_race_events | bs_race_events_unique | constraint bs_race_events_unique |
| bs_race_results | bs_race_results_pkey | constraint bs_race_results_pkey |
| bs_race_results | bs_race_results_race_date_course_code_race_no_key | constraint bs_race_results_race_date_course_code_race_no_key |
| bs_race_results | idx_bs_results_race | standalone |
| bs_source_first_seen | bs_source_first_seen_date_kind_idx | standalone |
| bs_source_first_seen | bs_source_first_seen_pkey | constraint bs_source_first_seen_pkey |
| bs_source_first_seen | bs_source_first_seen_race_date_course_code_race_no_data_kin_key | constraint bs_source_first_seen_race_date_course_code_race_no_data_kin_key |
| bs_theory_recommendations | bs_theory_recommendations_pkey | constraint bs_theory_recommendations_pkey |
| bs_theory_recommendations | bs_theory_recommendations_source_table_source_alert_id_key | constraint bs_theory_recommendations_source_table_source_alert_id_key |
| bs_theory_recommendations | idx_bs_theory_recommendations_race | standalone |
| bs_theory_recommendations | idx_bs_theory_recommendations_theory | standalone |

Standalone definitions:

```sql
CREATE INDEX bs_ichika_escape_surge_alerts_race_date_idx ON public.bs_ichika_escape_surge_alerts USING btree (race_date DESC, closing_time);
```

```sql
CREATE INDEX idx_bs_ichika_escape_surge_alerts_pending ON public.bs_ichika_escape_surge_alerts USING btree (race_date, notified, detected_at);
```

```sql
CREATE UNIQUE INDEX bs_race_entries_api_key ON public.bs_race_entries USING btree (race_date, course_code, race_no, boat_no);
```

```sql
CREATE INDEX bs_race_entries_date_course_idx ON public.bs_race_entries USING btree (race_date, course_code, race_no, boat_no);
```

```sql
CREATE UNIQUE INDEX bs_race_entries_engine_key ON public.bs_race_entries USING btree (race_date, course_code, race_no, boat_no);
```

```sql
CREATE INDEX bs_race_entries_racer_idx ON public.bs_race_entries USING btree (racer_registration_no, race_date DESC);
```

```sql
CREATE INDEX idx_bs_entries_exhibition_fl_v10 ON public.bs_race_entries USING btree (race_date, course_code, race_no, exhibition_fl) WHERE (exhibition_fl IS NOT NULL);
```

```sql
CREATE INDEX idx_bs_entries_official_exhibition_v7 ON public.bs_race_entries USING btree (race_date, course_code, race_no) WHERE (official_exhibition_time IS NOT NULL);
```

```sql
CREATE INDEX idx_bs_race_entries_ai_v16 ON public.bs_race_entries USING btree (race_date, course_code, race_no, boat_no);
```

```sql
CREATE INDEX idx_bs_race_entries_racer_registration ON public.bs_race_entries USING btree (racer_registration_no);
```

```sql
CREATE UNIQUE INDEX bs_race_events_api_key ON public.bs_race_events USING btree (race_date, course_code, race_no);
```

```sql
CREATE INDEX bs_race_events_date_course_idx ON public.bs_race_events USING btree (race_date, course_code, race_no);
```

```sql
CREATE UNIQUE INDEX bs_race_events_engine_key ON public.bs_race_events USING btree (race_date, course_code, race_no);
```

```sql
CREATE INDEX idx_bs_results_race ON public.bs_race_results USING btree (race_date, course_code, race_no);
```

```sql
CREATE INDEX bs_source_first_seen_date_kind_idx ON public.bs_source_first_seen USING btree (race_date DESC, data_kind, source);
```

```sql
CREATE INDEX idx_bs_theory_recommendations_race ON public.bs_theory_recommendations USING btree (race_date, course_code, race_no);
```

```sql
CREATE INDEX idx_bs_theory_recommendations_theory ON public.bs_theory_recommendations USING btree (theory_key, race_date DESC);
```
