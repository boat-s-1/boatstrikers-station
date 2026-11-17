#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"; : "${PGPASSWORD:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGDATABASE" == "agent_controller_ci" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
# A single claim must win under simultaneous attempts. No external delivery.
"${PSQL[@]}" -c "ALTER TABLE agent_monitor.notification_outbox ADD COLUMN claim_token text"
"${PSQL[@]}" -c "INSERT INTO agent_monitor.incident_reservations VALUES ('incident_claim_01','attempt_claim_01','reserved')"
"${PSQL[@]}" -c "INSERT INTO agent_monitor.notification_outbox VALUES ('outbox_claim_01','incident_claim_01','approved',NULL)"
CLAIM_SQL="UPDATE agent_monitor.notification_outbox SET claim_token='claim_alpha',delivery_state='approved' WHERE outbox_id='outbox_claim_01' AND claim_token IS NULL RETURNING outbox_id;"
# Competing claim uses a different token. Exactly one UPDATE must succeed.
"${PSQL[@]}" -c "BEGIN; UPDATE agent_monitor.notification_outbox SET claim_token='claim_alpha' WHERE outbox_id='outbox_claim_01' AND claim_token IS NULL; SELECT pg_sleep(2); COMMIT;" >/dev/null &
first=$!
sleep 0.2
"${PSQL[@]}" -c "UPDATE agent_monitor.notification_outbox SET claim_token='claim_beta' WHERE outbox_id='outbox_claim_01' AND claim_token IS NULL;" >/dev/null &
second=$!
wait "$first";wait "$second"
token=$("${PSQL[@]}" -c "SELECT claim_token FROM agent_monitor.notification_outbox WHERE outbox_id='outbox_claim_01'")
[[ "$token" == "claim_alpha" ]] || { echo "Unexpected claim winner: $token" >&2; exit 1; }
# Stale worker cannot release another worker's token.
"${PSQL[@]}" -c "UPDATE agent_monitor.notification_outbox SET claim_token=NULL WHERE outbox_id='outbox_claim_01' AND claim_token='claim_beta'"
token=$("${PSQL[@]}" -c "SELECT claim_token FROM agent_monitor.notification_outbox WHERE outbox_id='outbox_claim_01'")
[[ "$token" == "claim_alpha" ]] || { echo 'Stale worker released claim' >&2; exit 1; }
# Authorized owner may release a claim, but this does not authorize sending.
"${PSQL[@]}" -c "UPDATE agent_monitor.notification_outbox SET claim_token=NULL WHERE outbox_id='outbox_claim_01' AND claim_token='claim_alpha'"
count=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.notification_outbox WHERE outbox_id='outbox_claim_01' AND claim_token IS NULL AND delivery_state='approved'")
[[ "$count" == "1" ]] || { echo 'Claim release failed' >&2; exit 1; }
echo 'PASS: competing claim, stale-token fencing, and owner release'
