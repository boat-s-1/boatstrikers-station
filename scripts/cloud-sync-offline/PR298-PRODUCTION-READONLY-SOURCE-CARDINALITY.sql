-- DEPRECATED / DO NOT USE AS A READINESS GATE.
-- The live sync's event_rows and entry_rows count PREVIEW events and PREVIEW
-- racer rows, not scheduled races and program racers. Comparing entry_rows
-- to 6 * event_rows is INVALID for program completeness.
-- See PR298-CRITICAL-SYNC-LOG-SEMANTICS-CORRECTION-20261117.md.
-- This replacement is a safe read-only descriptive report only.
SELECT race_date,
 count(*) FILTER (WHERE status='success') AS successful_preview_sync_calls,
 max(event_rows) FILTER (WHERE status='success') AS max_preview_event_rows,
 max(entry_rows) FILTER (WHERE status='success') AS max_preview_racer_rows,
 (SELECT count(*) FROM public.bs_race_events e
  WHERE e.race_date=l.race_date) AS persisted_program_events,
 (SELECT count(*) FROM public.bs_race_entries e
  WHERE e.race_date=l.race_date) AS persisted_program_entries,
 'DESCRIPTIVE ONLY: preview rows cannot prove program completeness' AS interpretation
FROM public.bs_live_source_sync_logs l
WHERE sync_kind='live_all'
 AND race_date BETWEEN (now() AT TIME ZONE 'Asia/Tokyo')::date-6
 AND (now() AT TIME ZONE 'Asia/Tokyo')::date
GROUP BY race_date
ORDER BY race_date;
