#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}"; : "${PGPORT:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGPORT" == "5432" && "$PGDATABASE" == "agent_controller_ci" && "$PGUSER" == "agent_ci" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
first=$(mktemp)
second=$(mktemp)
trap 'rm -f "$first" "$second"' EXIT
(
 "${PSQL[@]}" -c "BEGIN; SELECT agent_monitor.classify_receipt_replay_ci('ci_concurrent_receipt_a','ci_concurrent_incident','digest_a'); SELECT pg_sleep(2); COMMIT;" >"$first"
) &
pid1=$!
sleep 0.3
(
 "${PSQL[@]}" -c "SELECT agent_monitor.classify_receipt_replay_ci('ci_concurrent_receipt_b','ci_concurrent_incident','digest_b')" >"$second"
) &
pid2=$!
wait "$pid1"
wait "$pid2"
grep -qx 'accepted_new' "$first" || { echo 'First claimant not accepted' >&2; exit 1; }
grep -qx 'hold_conflicting_replay' "$second" || { echo "Concurrent conflicting claim was not held: $(cat "$second")" >&2; exit 1; }
n=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.receipt_replay_guard_ci WHERE incident_key='ci_concurrent_incident'")
[[ "$n" == "1" ]] || { echo "Expected one committed receipt, got $n" >&2; exit 1; }
echo 'PASS: two PostgreSQL sessions serialize competing receipt identities; one accepted, one conflict-held'
