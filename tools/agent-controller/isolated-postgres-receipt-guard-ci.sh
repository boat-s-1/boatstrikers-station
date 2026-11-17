#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"; : "${PGPORT:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGDATABASE" == "agent_controller_ci" && "$PGUSER" == "agent_ci" && "$PGPORT" == "5432" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
"${PSQL[@]}" <<'SQL'
CREATE OR REPLACE FUNCTION agent_monitor.require_receipt_on_delivery_ci()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.delivery_state='delivered' AND OLD.delivery_state IS DISTINCT FROM 'delivered'
    AND NOT EXISTS (SELECT 1 FROM agent_monitor.delivery_receipts_ci r WHERE r.incident_key=NEW.incident_key) THEN
   RAISE EXCEPTION 'receipt required for delivered state';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER require_receipt_on_delivery_ci
BEFORE UPDATE OF delivery_state ON agent_monitor.notification_outbox
FOR EACH ROW EXECUTE FUNCTION agent_monitor.require_receipt_on_delivery_ci();
INSERT INTO agent_monitor.incident_reservations VALUES ('ci_receipt_guard_01','ci_receipt_guard_attempt','reserved');
INSERT INTO agent_monitor.notification_outbox VALUES ('ci_receipt_guard_outbox','ci_receipt_guard_01','pending_review');
UPDATE agent_monitor.notification_outbox SET delivery_state='approved' WHERE incident_key='ci_receipt_guard_01';
UPDATE agent_monitor.notification_outbox SET delivery_state='in_flight' WHERE incident_key='ci_receipt_guard_01';
SQL
if "${PSQL[@]}" -c "UPDATE agent_monitor.notification_outbox SET delivery_state='delivered' WHERE incident_key='ci_receipt_guard_01'" >/dev/null 2>&1; then
 echo 'Delivered without receipt unexpectedly accepted' >&2; exit 1
fi
state=$("${PSQL[@]}" -c "SELECT delivery_state FROM agent_monitor.notification_outbox WHERE incident_key='ci_receipt_guard_01'")
[[ "$state" == "in_flight" ]] || { echo "Failed update changed state: $state" >&2; exit 1; }
"${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.delivery_receipts_ci VALUES ('ci_receipt_guard_01','synthetic_receipt_guard_01'); UPDATE agent_monitor.notification_outbox SET delivery_state='delivered' WHERE incident_key='ci_receipt_guard_01'; COMMIT;"
state=$("${PSQL[@]}" -c "SELECT delivery_state FROM agent_monitor.notification_outbox WHERE incident_key='ci_receipt_guard_01'")
[[ "$state" == "delivered" ]] || { echo "Expected delivered, got $state" >&2; exit 1; }
if "${PSQL[@]}" -c "UPDATE agent_monitor.notification_outbox SET delivery_state='pending_review' WHERE incident_key='ci_receipt_guard_01'" >/dev/null 2>&1; then
 echo 'Terminal delivered reopened unexpectedly' >&2; exit 1
fi
echo 'PASS: database rejects delivered without receipt and accepts same-transaction synthetic receipt'
