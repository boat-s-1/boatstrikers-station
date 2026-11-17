#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"; : "${PGPASSWORD:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGDATABASE" == "agent_controller_ci" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
"${PSQL[@]}" <<'SQL'
CREATE TABLE agent_monitor.delivery_receipts_ci (
 incident_key text PRIMARY KEY REFERENCES agent_monitor.incident_reservations(incident_key),
 provider_receipt_id text NOT NULL UNIQUE,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO agent_monitor.incident_reservations VALUES ('incident_receipt_01','attempt_receipt_01','reserved');
INSERT INTO agent_monitor.notification_outbox VALUES ('outbox_receipt_01','incident_receipt_01','approved');
SQL
# An invalid receipt must abort status change and leave the outbox approved.
if "${PSQL[@]}" -c "BEGIN; UPDATE agent_monitor.notification_outbox SET delivery_state='delivered' WHERE incident_key='incident_receipt_01'; INSERT INTO agent_monitor.delivery_receipts_ci VALUES ('incident_receipt_01',NULL); COMMIT;" >/dev/null 2>&1; then
 echo 'NULL provider receipt unexpectedly accepted' >&2; exit 1
fi
state=$("${PSQL[@]}" -c "SELECT delivery_state FROM agent_monitor.notification_outbox WHERE incident_key='incident_receipt_01'")
[[ "$state" == "approved" ]] || { echo 'Delivery status committed without receipt' >&2; exit 1; }
# A successful receipt and state transition commit together.
"${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.delivery_receipts_ci VALUES ('incident_receipt_01','synthetic_receipt_01'); UPDATE agent_monitor.notification_outbox SET delivery_state='delivered' WHERE incident_key='incident_receipt_01' AND delivery_state='approved'; COMMIT;"
n=$("${PSQL[@]}" -c "SELECT (SELECT delivery_state FROM agent_monitor.notification_outbox WHERE incident_key='incident_receipt_01')||':'||(SELECT count(*) FROM agent_monitor.delivery_receipts_ci WHERE incident_key='incident_receipt_01')::text")
[[ "$n" == "delivered:1" ]] || { echo "Receipt/state mismatch: $n" >&2; exit 1; }
# Replayed receipt cannot duplicate records or change a delivered item.
"${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.delivery_receipts_ci VALUES ('incident_receipt_01','synthetic_receipt_01') ON CONFLICT DO NOTHING; UPDATE agent_monitor.notification_outbox SET delivery_state='delivered' WHERE incident_key='incident_receipt_01' AND delivery_state='approved'; COMMIT;"
n=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.delivery_receipts_ci WHERE incident_key='incident_receipt_01'")
[[ "$n" == "1" ]] || { echo 'Receipt replay duplicated rows' >&2; exit 1; }
echo 'PASS: synthetic receipt and outbox status atomic commit, rollback, replay'
