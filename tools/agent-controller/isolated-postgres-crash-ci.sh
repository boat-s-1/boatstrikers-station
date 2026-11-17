#!/usr/bin/env bash
set -euo pipefail
# Crash-injection in a disposable CI PostgreSQL service. No production credentials.
: "${PGHOST:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"; : "${PGPASSWORD:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGDATABASE" == "agent_controller_ci" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
# Kill a backend after it has inserted an uncommitted reservation.
PGAPPNAME=agent_crash_injection "${PSQL[@]}" -c "BEGIN; INSERT INTO agent_monitor.incident_reservations VALUES ('incident_crash_01','attempt_crash_01','reserved'); SELECT pg_sleep(30); COMMIT;" >/dev/null 2>&1 &
worker=$!
backend=''
for i in {1..60}; do
 backend=$("${PSQL[@]}" -c "SELECT pid FROM pg_stat_activity WHERE application_name='agent_crash_injection' AND state='active' AND query LIKE '%pg_sleep(30)%' LIMIT 1")
 [[ -n "$backend" ]] && break
 sleep 0.1
done
[[ -n "$backend" ]] || { echo 'Crash worker not observed' >&2; kill "$worker" 2>/dev/null || true; exit 1; }
"${PSQL[@]}" -c "SELECT pg_terminate_backend($backend)" | grep -qx t
if wait "$worker"; then echo 'Crash worker unexpectedly committed' >&2; exit 1; fi
count=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.incident_reservations WHERE incident_key='incident_crash_01'")
[[ "$count" == "0" ]] || { echo "Uncommitted reservation survived crash: $count" >&2; exit 1; }
# Retrying after a crash must be possible without duplicates.
"${PSQL[@]}" -c "INSERT INTO agent_monitor.incident_reservations VALUES ('incident_crash_01','attempt_crash_02','reserved') ON CONFLICT DO NOTHING"
"${PSQL[@]}" -c "INSERT INTO agent_monitor.incident_reservations VALUES ('incident_crash_01','attempt_crash_03','reserved') ON CONFLICT DO NOTHING"
count=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.incident_reservations WHERE incident_key='incident_crash_01'")
[[ "$count" == "1" ]] || { echo "Expected one retried reservation, got $count" >&2; exit 1; }
echo 'PASS: killed uncommitted backend rolls back; retry creates exactly one reservation'
