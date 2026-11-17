-- PR #298: production SELECT-only diagnosis of Cron "success" masking missing event/entry updates.
-- Read-only. No API requests. No writes. Summarize each JST date from existing sync logs.
WITH days AS (
 SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date - n AS race_date
 FROM generate_series(0,7) n
), log_summary AS (
 SELECT race_date,
 count(*) FILTER (WHERE status='success') AS success_calls,
 count(*) FILTER (WHERE status='error') AS error_calls,
 coalesce(sum(entry_rows) FILTER (WHERE status='success'),0) AS preview_entry_payload_rows,
 coalesce(sum(event_rows) FILTER (WHERE status='success'),0) AS preview_event_payload_rows,
 coalesce(sum(result_rows) FILTER (WHERE status='success'),0) AS result_payload_rows,
 coalesce(sum((detail #>> '{preview,updated_rows}')::bigint) FILTER (WHERE status='success'),0) AS preview_entry_updates,
 coalesce(sum((detail #>> '{events,updated_rows}')::bigint) FILTER (WHERE status='success'),0) AS preview_event_updates,
 coalesce(sum((detail #>> '{results,result_rows}')::bigint) FILTER (WHERE status='success'),0) AS result_upserts,
 coalesce(sum((detail #>> '{results,result_entry_rows}')::bigint) FILTER (WHERE status='success'),0) AS result_entry_updates
 FROM public.bs_live_source_sync_logs
 WHERE source='boatraceopenapi/v1' AND sync_kind='live_all'
 AND race_date >= (now() AT TIME ZONE 'Asia/Tokyo')::date - 7
 GROUP BY race_date
), stored AS (
 SELECT d.race_date,
 (SELECT count(*) FROM public.bs_race_events e WHERE e.race_date=d.race_date) AS events_stored,
 (SELECT count(*) FROM public.bs_race_entries e WHERE e.race_date=d.race_date) AS entries_stored,
 (SELECT count(*) FROM public.bs_race_results e WHERE e.race_date=d.race_date) AS results_stored
 FROM days d
)
SELECT s.*,coalesce(l.success_calls,0) success_calls,coalesce(l.error_calls,0) error_calls,
 coalesce(l.preview_entry_payload_rows,0) preview_entry_payload_rows,
 coalesce(l.preview_event_payload_rows,0) preview_event_payload_rows,
 coalesce(l.result_payload_rows,0) result_payload_rows,
 coalesce(l.preview_entry_updates,0) preview_entry_updates,
 coalesce(l.preview_event_updates,0) preview_event_updates,
 coalesce(l.result_upserts,0) result_upserts,
 coalesce(l.result_entry_updates,0) result_entry_updates,
 CASE WHEN s.results_stored>0 AND (s.events_stored=0 OR s.entries_stored=0)
       AND coalesce(l.success_calls,0)>0 AND coalesce(l.result_upserts,0)>0
       AND coalesce(l.preview_entry_updates,0)=0 AND coalesce(l.preview_event_updates,0)=0
      THEN 'SUCCESS_WITH_MISSING_BOOTSTRAP'
      WHEN s.results_stored=0 THEN 'NO_RESULT_BASELINE'
      WHEN s.events_stored>0 AND s.entries_stored>=6*s.results_stored THEN 'RESULT_ANCHORED_PRESENT'
      ELSE 'INVESTIGATE' END diagnosis
FROM stored s LEFT JOIN log_summary l USING(race_date)
ORDER BY s.race_date DESC;
