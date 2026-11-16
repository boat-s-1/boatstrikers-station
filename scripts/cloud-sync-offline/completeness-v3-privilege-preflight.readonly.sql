-- Read-only production/isolated preflight. No writes.
WITH needed_sequences AS (
 SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='S'
   AND c.relname IN ('bs_live_source_sync_logs_id_seq','bs_race_data_quality_alerts_id_seq')
), needed_tables AS (
 SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public'
   AND c.relname IN ('bs_race_data_quality_alerts','bs_live_source_sync_logs',
                     'bs_race_results','bs_race_events','bs_race_entries')
), checks AS (
 SELECT 'sequence:'||relname AS check_name,
        has_sequence_privilege('service_role',oid,'USAGE') AS pass
 FROM needed_sequences
 UNION ALL
 SELECT 'table:'||relname,
        has_table_privilege('service_role',oid,'SELECT')
        AND CASE WHEN relname IN ('bs_race_data_quality_alerts','bs_live_source_sync_logs')
                 THEN has_table_privilege('service_role',oid,'INSERT')
                      AND has_table_privilege('service_role',oid,'UPDATE')
                 ELSE true END
 FROM needed_tables
 UNION ALL
 SELECT 'service_role_bypassrls',rolbypassrls FROM pg_roles WHERE rolname='service_role'
 UNION ALL
 SELECT 'v2_quality_service_execute',
        has_function_privilege('service_role',
          'public.bs_race_data_quality_rows(date)','EXECUTE')
)
SELECT check_name,pass FROM checks ORDER BY check_name;
