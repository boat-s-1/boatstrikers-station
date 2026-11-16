-- Pure SELECT fixture: no tables, extensions, writes, notifications or paid branch.
-- Models the fail-closed checks added to the V3 recorder in edad2e14.
WITH cases(case_name,quality_races,active_alert_keys,quality_keys,expected_stop) AS (
 VALUES
 ('empty day',0,ARRAY[]::text[],ARRAY[]::text[],true),
 ('active key vanished',1,ARRAY['09/01']::text[],ARRAY['09/02']::text[],true),
 ('active key preserved and incomplete',1,ARRAY['09/01']::text[],ARRAY['09/01']::text[],false),
 ('active key preserved and repaired',1,ARRAY['09/01']::text[],ARRAY['09/01']::text[],false),
 ('no prior alerts',1,ARRAY[]::text[],ARRAY['09/01']::text[],false)
), actual AS (
 SELECT case_name,expected_stop,
   (quality_races=0 OR EXISTS (
     SELECT 1 FROM unnest(active_alert_keys) AS a(k)
     WHERE NOT (a.k=ANY(quality_keys))
   )) AS actual_stop
 FROM cases
)
SELECT case_name,expected_stop,actual_stop,
       CASE WHEN expected_stop=actual_stop THEN 'PASS' ELSE 'FAIL' END AS verdict
FROM actual ORDER BY case_name;
-- This tests the Boolean decision model, NOT the PL/pgSQL recorder runtime.
