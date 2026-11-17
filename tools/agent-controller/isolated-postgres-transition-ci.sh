#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"; : "${PGPASSWORD:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGDATABASE" == "agent_controller_ci" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
"${PSQL[@]}" <<'SQL'
INSERT INTO agent_monitor.incident_reservations VALUES ('incident_transition_01','attempt_transition_01','reserved');
INSERT INTO agent_monitor.notification_outbox VALUES ('outbox_transition_01','incident_transition_01','pending_review');
CREATE OR REPLACE FUNCTION agent_monitor.guard_outbox_transition_ci()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.delivery_state = OLD.delivery_state THEN RETURN NEW; END IF;
 IF NOT (
   (OLD.delivery_state='pending_review' AND NEW.delivery_state='approved')
   OR (OLD.delivery_state='approved' AND NEW.delivery_state IN ('pending_review','in_flight'))
   OR (OLD.delivery_state='in_flight' AND NEW.delivery_state IN ('delivered','failed','delivery_unknown'))
   OR (OLD.delivery_state='failed' AND NEW.delivery_state='pending_review')
   OR (OLD.delivery_state='delivery_unknown' AND NEW.delivery_state IN ('pending_review','delivered'))
 ) THEN
   RAISE EXCEPTION 'invalid outbox transition: % to %', OLD.delivery_state, NEW.delivery_state;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_outbox_transition_ci
BEFORE UPDATE OF delivery_state ON agent_monitor.notification_outbox
FOR EACH ROW EXECUTE FUNCTION agent_monitor.guard_outbox_transition_ci();
SQL
# No direct pending -> delivered transition, even if application attempts it.
if "${PSQL[@]}" -c "UPDATE agent_monitor.notification_outbox SET delivery_state='delivered' WHERE incident_key='incident_transition_01'" >/dev/null 2>&1; then
 echo 'Direct delivery transition unexpectedly allowed' >&2; exit 1
fi
state=$("${PSQL[@]}" -c "SELECT delivery_state FROM agent_monitor.notification_outbox WHERE incident_key='incident_transition_01'")
[[ "$state" == "pending_review" ]] || { echo "Invalid transition changed state: $state" >&2; exit 1; }
# Valid sequence with synthetic receipt persisted transactionally.
"${PSQL[@]}" -c "UPDATE agent_monitor.notification_outbox SET delivery_state='approved' WHERE incident_key='incident_transition_01'"
"${PSQL[@]}" -c "UPDATE agent_monitor.notification_outbox SET delivery_state='in_flight' WHERE incident_key='incident_transition_01'"
"${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.delivery_receipts_ci VALUES ('incident_transition_01','synthetic_transition_receipt_01'); UPDATE agent_monitor.notification_outbox SET delivery_state='delivered' WHERE incident_key='incident_transition_01'; COMMIT;"
# Delivered is terminal, including attempted replay to pending.
if "${PSQL[@]}" -c "UPDATE agent_monitor.notification_outbox SET delivery_state='pending_review' WHERE incident_key='incident_transition_01'" >/dev/null 2>&1; then
 echo 'Delivered outbox unexpectedly reopened' >&2; exit 1
fi
state=$("${PSQL[@]}" -c "SELECT delivery_state FROM agent_monitor.notification_outbox WHERE incident_key='incident_transition_01'")
[[ "$state" == "delivered" ]] || { echo "Terminal state was changed: $state" >&2; exit 1; }
echo 'PASS: database rejects illegal transitions and terminal state reopen'
