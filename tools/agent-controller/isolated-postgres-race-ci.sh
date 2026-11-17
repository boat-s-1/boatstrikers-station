#!/usr/bin/env bash
set -euo pipefail
# Disposable PostgreSQL service only. Never supply production credentials.
: "${PGHOST:?missing ephemeral PGHOST}"
: "${PGPORT:?missing ephemeral PGPORT}"
: "${PGDATABASE:?missing ephemeral PGDATABASE}"
: "${PGUSER:?missing ephemeral PGUSER}"
: "${PGPASSWORD:?missing ephemeral PGPASSWORD}"
if [[ "$PGHOST" != "127.0.0.1" || "$PGDATABASE" != "agent_controller_ci" ]]; then
 echo 'Refusing non-CI database target' >&2; exit 2
fi
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
"${PSQL[@]}" <<'SQL'
CREATE SCHEMA agent_monitor;
CREATE TABLE agent_monitor.incident_reservations (
 incident_key text PRIMARY KEY,
 attempt_id text NOT NULL,
 reservation_state text NOT NULL CHECK (reservation_state IN ('reserved','delivered','failed'))
);
CREATE TABLE agent_monitor.notification_outbox (
 outbox_id text PRIMARY KEY,
 incident_key text NOT NULL REFERENCES agent_monitor.incident_reservations(incident_key),
 delivery_state text NOT NULL CHECK (delivery_state IN ('pending_review','approved','delivered','failed'))
);
CREATE UNIQUE INDEX notification_outbox_one_per_incident ON agent_monitor.notification_outbox(incident_key);
SQL
# Two real PostgreSQL sessions compete for the same key. The winner sleeps
# before commit, forcing the loser to encounter the uncommitted unique index.
"${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.incident_reservations VALUES ('incident_000001','attempt_000001','reserved') ON CONFLICT DO NOTHING; SELECT pg_sleep(2); COMMIT;" >/dev/null &
first=$!
sleep 0.2
"${PSQL[@]}" -c "INSERT INTO agent_monitor.incident_reservations VALUES ('incident_000001','attempt_000002','reserved') ON CONFLICT DO NOTHING;" >/dev/null &
second=$!
wait "$first"
wait "$second"
count=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.incident_reservations")
[[ "$count" == "1" ]] || { echo "Expected 1 reservation, got $count" >&2; exit 1; }
# Competing outbox writes must yield exactly one row.
"${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.notification_outbox VALUES ('outbox_000001','incident_000001','pending_review') ON CONFLICT DO NOTHING; SELECT pg_sleep(2); COMMIT;" >/dev/null &
first=$!
sleep 0.2
"${PSQL[@]}" -c "INSERT INTO agent_monitor.notification_outbox VALUES ('outbox_000002','incident_000001','pending_review') ON CONFLICT DO NOTHING;" >/dev/null &
second=$!
wait "$first"
wait "$second"
count=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.notification_outbox")
[[ "$count" == "1" ]] || { echo "Expected 1 outbox row, got $count" >&2; exit 1; }
echo 'PASS: concurrent reservations and outbox uniqueness (two real PostgreSQL sessions)'
