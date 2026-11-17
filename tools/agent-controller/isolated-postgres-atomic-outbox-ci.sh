#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"; : "${PGPASSWORD:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGDATABASE" == "agent_controller_ci" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
# Failure after reservation but before outbox insert must rollback both.
if "${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.incident_reservations VALUES ('incident_atomic_fail','attempt_atomic_fail','reserved'); INSERT INTO agent_monitor.notification_outbox VALUES ('outbox_atomic_fail','incident_atomic_fail','invalid_state'); COMMIT;" >/dev/null 2>&1; then
 echo 'Invalid delivery state unexpectedly accepted' >&2; exit 1
fi
n=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.incident_reservations WHERE incident_key='incident_atomic_fail'")
[[ "$n" == "0" ]] || { echo 'Partial reservation persisted after outbox error' >&2; exit 1; }
# Success path commits reservation and outbox in one transaction.
"${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.incident_reservations VALUES ('incident_atomic_ok','attempt_atomic_ok','reserved'); INSERT INTO agent_monitor.notification_outbox VALUES ('outbox_atomic_ok','incident_atomic_ok','pending_review'); COMMIT;"
n=$("${PSQL[@]}" -c "SELECT (SELECT count(*) FROM agent_monitor.incident_reservations WHERE incident_key='incident_atomic_ok')::text||':'||(SELECT count(*) FROM agent_monitor.notification_outbox WHERE incident_key='incident_atomic_ok')::text")
[[ "$n" == "1:1" ]] || { echo "Atomic commit missing row: $n" >&2; exit 1; }
# Replaying the same transaction is idempotent; a new outbox id must not bypass unique incident key.
"${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.incident_reservations VALUES ('incident_atomic_ok','attempt_retry','reserved') ON CONFLICT DO NOTHING; INSERT INTO agent_monitor.notification_outbox VALUES ('outbox_atomic_retry','incident_atomic_ok','pending_review') ON CONFLICT DO NOTHING; COMMIT;"
n=$("${PSQL[@]}" -c "SELECT (SELECT count(*) FROM agent_monitor.incident_reservations WHERE incident_key='incident_atomic_ok')::text||':'||(SELECT count(*) FROM agent_monitor.notification_outbox WHERE incident_key='incident_atomic_ok')::text")
[[ "$n" == "1:1" ]] || { echo "Replay duplicated rows: $n" >&2; exit 1; }
echo 'PASS: atomic incident/outbox rollback, commit, and idempotent replay'
