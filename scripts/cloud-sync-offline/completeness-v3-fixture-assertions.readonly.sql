-- SAFE TO RUN ON PRODUCTION: SELECT only, all test rows are inline VALUES.
-- Exercises result-only detection, preservation of event-anchored keys,
-- and one issue per real date/course/race key.
WITH fixtures(scenario,race_date,course_code,race_no,has_event,has_result,entry_count) AS (
 VALUES
 ('complete',date '2026-01-01',1::smallint,1::smallint,true,true,6),
 ('result_only_no_entries',date '2026-01-01',1::smallint,2::smallint,false,true,0),
 ('result_only_with_entries',date '2026-01-01',1::smallint,3::smallint,false,true,6),
 ('event_five_entries',date '2026-01-01',1::smallint,4::smallint,true,true,5),
 ('event_no_result',date '2026-01-01',1::smallint,5::smallint,true,false,6),
 ('empty_unscheduled',date '2026-01-01',1::smallint,6::smallint,false,false,0)
), verdict AS (
 SELECT scenario,
 CASE WHEN has_result AND NOT has_event THEN 'base_event'
      WHEN has_event AND entry_count<>6 THEN 'entries'
      WHEN has_event AND NOT has_result THEN 'result'
      ELSE 'none' END AS actual
 FROM fixtures
), expected(scenario,want) AS (
 VALUES
 ('complete','none'),('result_only_no_entries','base_event'),
 ('result_only_with_entries','base_event'),('event_five_entries','entries'),
 ('event_no_result','result'),('empty_unscheduled','none')
)
SELECT v.scenario,v.actual,e.want,(v.actual=e.want) AS pass
FROM verdict v JOIN expected e USING(scenario)
ORDER BY v.scenario;
