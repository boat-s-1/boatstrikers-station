#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"; : "${PGPASSWORD:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGDATABASE" == "agent_controller_ci" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
# A complete DB-only synthetic lifecycle, with no network and no real send.
"${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.incident_reservations VALUES ('incident_lifecycle_01','attempt_lifecycle_01','reserved'); INSERT INTO agent_monitor.notification_outbox VALUES ('outbox_lifecycle_01','incident_lifecycle_01','pending_review'); COMMIT;"
# Explicit simulated approval is test data, not operator approval.
"${PSQL[@]}" -c "UPDATE agent_monitor.notification_outbox SET delivery_state='approved' WHERE incident_key='incident_lifecycle_01' AND delivery_state='pending_review'"
# Simulate a provider response and store receipt + state atomically.
"${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.delivery_receipts_ci VALUES ('incident_lifecycle_01','synthetic_lifecycle_receipt_01'); UPDATE agent_monitor.notification_outbox SET delivery_state='delivered' WHERE incident_key='incident_lifecycle_01' AND delivery_state='approved'; COMMIT;"
# Restart/replay: same incident and outbox cannot be duplicated, receipt cannot be changed.
"${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.incident_reservations VALUES ('incident_lifecycle_01','attempt_lifecycle_retry','reserved') ON CONFLICT DO NOTHING; INSERT INTO agent_monitor.notification_outbox VALUES ('outbox_lifecycle_retry','incident_lifecycle_01','pending_review') ON CONFLICT DO NOTHING; INSERT INTO agent_monitor.delivery_receipts_ci VALUES ('incident_lifecycle_01','synthetic_lifecycle_receipt_01') ON CONFLICT DO NOTHING; COMMIT;"
counts=$("${PSQL[@]}" -c "SELECT (SELECT count(*) FROM agent_monitor.incident_reservations WHERE incident_key='incident_lifecycle_01')::text||':'||(SELECT count(*) FROM agent_monitor.notification_outbox WHERE incident_key='incident_lifecycle_01')::text||':'||(SELECT count(*) FROM agent_monitor.delivery_receipts_ci WHERE incident_key='incident_lifecycle_01')::text||':'||(SELECT delivery_state FROM agent_monitor.notification_outbox WHERE incident_key='incident_lifecycle_01')")
[[ "$counts" == "1:1:1:delivered" ]] || { echo "Unexpected lifecycle state: $counts" >&2; exit 1; }
echo 'PASS: synthetic DB-only lifecycle and replay (no provider calls)'
