# PR #298 — notification delivery and cutover gate (2026-11-17)

Status: HOLD. This is an evidence ledger, not production authorization.

## Production read-only observations

- The V2 recorder calls pg_notify on channel boatstrikers_data_quality_alert for partial status, with race_date, issue_count, checked_at.
- The recorder inserts alert rows and logs notification_target=admin_alert_center. This JSON label does NOT establish a live listener.
- Public SQL function catalog search found the V2 recorder referencing this channel; does not rule out external consumers or other schemas.
- GitHub default-branch code searches for admin_alert_center and boatstrikers_data_quality_alert returned no results; feature branches and external services are not covered.
- Cron job 24 succeeded in its last eight runs, despite 600 unalerted result-only race keys.

## End-to-end acceptance criteria

1. Identify the actual admin alert UI, database subscription mechanism and recipient routing. Do not assume pg_notify reaches an external service.
2. In isolated DB, attach a real LISTEN consumer before recorder COMMIT. Assert notification arrives after COMMIT, not after ROLLBACK, with correct JSON fields.
3. Test repeat recorder calls: unique database alert row, but partial-run notifications may repeat. Consumer must tolerate duplicates.
4. Confirm delivery limits and rate controls before historical backfill, which can emit four notifications.
5. Confirm admin UI handles active/resolved rows and the new base_event missing field, critical severity, and null course_name.
6. Confirm anon/authenticated cannot EXECUTE candidate functions; never expose service_role keys.
7. Document operator response: alert persistence does not repair source data.
8. Keep production feature flag OFF and PR Draft until source bootstrap transaction/retry/trigger tests pass.

Conclusion: Database alert persistence passed on isolated minimal schema; external notification delivery remains unverified. No production write or Cron change.
