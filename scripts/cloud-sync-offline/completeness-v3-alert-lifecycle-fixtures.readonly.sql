-- Read-only model tests for v3 alert lifecycle; no real alert writes or notifications.
WITH fixtures(scenario,existing_alert_active,v3_issue_present,first_seen_epoch) AS (
 VALUES
 ('new_missing_base',false,true,100::bigint),
 ('retry_missing_base',true,true,100::bigint),
 ('partial_repair',true,true,100::bigint),
 ('fully_repaired',true,false,100::bigint),
 ('already_resolved',false,false,100::bigint)
), verdict AS (
 SELECT scenario,
   CASE WHEN v3_issue_present THEN 'active'
        WHEN existing_alert_active THEN 'resolved'
        ELSE 'unchanged' END AS next_action,
   CASE WHEN existing_alert_active AND v3_issue_present THEN first_seen_epoch
        WHEN NOT existing_alert_active AND v3_issue_present THEN first_seen_epoch
        ELSE first_seen_epoch END AS retained_first_seen
 FROM fixtures
), expected(scenario,want) AS (
 VALUES ('new_missing_base','active'),('retry_missing_base','active'),
        ('partial_repair','active'),('fully_repaired','resolved'),
        ('already_resolved','unchanged')
)
SELECT v.scenario,v.next_action,e.want,
       (v.next_action=e.want AND v.retained_first_seen=100) AS pass
FROM verdict v JOIN expected e USING(scenario)
ORDER BY v.scenario;
