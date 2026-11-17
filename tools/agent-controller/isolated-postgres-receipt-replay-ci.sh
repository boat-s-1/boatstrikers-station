#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}"; : "${PGPORT:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGPORT" == "5432" && "$PGDATABASE" == "agent_controller_ci" && "$PGUSER" == "agent_ci" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
"${PSQL[@]}" <<'SQL'
CREATE TABLE agent_monitor.receipt_replay_guard_ci (
 receipt_id text PRIMARY KEY,
 incident_key text NOT NULL UNIQUE,
 payload_digest text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO agent_monitor.receipt_replay_guard_ci VALUES ('ci_replay_receipt_01','ci_replay_incident_01','digest_01');
SQL
n=$("${PSQL[@]}" -c "WITH ins AS (INSERT INTO agent_monitor.receipt_replay_guard_ci VALUES ('ci_replay_receipt_01','ci_replay_incident_01','digest_01') ON CONFLICT DO NOTHING RETURNING receipt_id) SELECT count(*) FROM ins")
[[ "$n" == "0" ]] || { echo 'Exact replay unexpectedly inserted' >&2; exit 1; }
n=$("${PSQL[@]}" -c "WITH ins AS (INSERT INTO agent_monitor.receipt_replay_guard_ci VALUES ('ci_replay_receipt_01','ci_other_incident','different_digest') ON CONFLICT DO NOTHING RETURNING receipt_id) SELECT count(*) FROM ins")
[[ "$n" == "0" ]] || { echo 'Receipt ID reused for other incident' >&2; exit 1; }
n=$("${PSQL[@]}" -c "WITH ins AS (INSERT INTO agent_monitor.receipt_replay_guard_ci VALUES ('ci_other_receipt','ci_replay_incident_01','different_digest') ON CONFLICT DO NOTHING RETURNING receipt_id) SELECT count(*) FROM ins")
[[ "$n" == "0" ]] || { echo 'Incident reused for different receipt' >&2; exit 1; }
n=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.receipt_replay_guard_ci WHERE incident_key='ci_replay_incident_01'")
[[ "$n" == "1" ]] || { echo "Expected one replay ledger row, got $n" >&2; exit 1; }
echo 'PASS: exact replay and conflicting receipt/incident identities cannot create second ledger row'
