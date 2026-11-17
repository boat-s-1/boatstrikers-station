#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"; : "${PGPASSWORD:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGDATABASE" == "agent_controller_ci" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
# The fencing epoch is monotonic. Old owners cannot update a row after takeover.
"${PSQL[@]}" <<'SQL'
CREATE TABLE agent_monitor.lease_fencing_ci (
 incident_key text PRIMARY KEY,
 owner_token text,
 epoch bigint NOT NULL DEFAULT 0 CHECK(epoch >= 0),
 expires_at timestamptz
);
INSERT INTO agent_monitor.lease_fencing_ci VALUES ('lease_incident_01',NULL,0,NULL);
SQL
# Initial acquisition.
"${PSQL[@]}" -c "UPDATE agent_monitor.lease_fencing_ci SET owner_token='owner_a',epoch=epoch+1,expires_at=clock_timestamp()+interval '1 second' WHERE incident_key='lease_incident_01' AND owner_token IS NULL"
epoch=$("${PSQL[@]}" -c "SELECT epoch FROM agent_monitor.lease_fencing_ci WHERE incident_key='lease_incident_01'")
[[ "$epoch" == "1" ]] || exit 1
sleep 1.2
# Takeover after expiry requires a fresh epoch.
"${PSQL[@]}" -c "UPDATE agent_monitor.lease_fencing_ci SET owner_token='owner_b',epoch=epoch+1,expires_at=clock_timestamp()+interval '30 seconds' WHERE incident_key='lease_incident_01' AND expires_at<clock_timestamp()"
owner=$("${PSQL[@]}" -c "SELECT owner_token||':'||epoch FROM agent_monitor.lease_fencing_ci WHERE incident_key='lease_incident_01'")
[[ "$owner" == "owner_b:2" ]] || { echo "Lease takeover failed: $owner" >&2; exit 1; }
# Stale owner cannot release or mutate after epoch changed.
"${PSQL[@]}" -c "UPDATE agent_monitor.lease_fencing_ci SET owner_token=NULL WHERE incident_key='lease_incident_01' AND owner_token='owner_a' AND epoch=1"
owner=$("${PSQL[@]}" -c "SELECT owner_token||':'||epoch FROM agent_monitor.lease_fencing_ci WHERE incident_key='lease_incident_01'")
[[ "$owner" == "owner_b:2" ]] || { echo 'Stale owner altered lease' >&2; exit 1; }
# Current owner can renew with matching epoch.
"${PSQL[@]}" -c "UPDATE agent_monitor.lease_fencing_ci SET expires_at=clock_timestamp()+interval '30 seconds' WHERE incident_key='lease_incident_01' AND owner_token='owner_b' AND epoch=2 AND expires_at>clock_timestamp()"
"${PSQL[@]}" -c "UPDATE agent_monitor.lease_fencing_ci SET owner_token=NULL,expires_at=NULL WHERE incident_key='lease_incident_01' AND owner_token='owner_b' AND epoch=2"
owner=$("${PSQL[@]}" -c "SELECT coalesce(owner_token,'released')||':'||epoch FROM agent_monitor.lease_fencing_ci WHERE incident_key='lease_incident_01'")
[[ "$owner" == "released:2" ]] || { echo "Owner release failed: $owner" >&2; exit 1; }
echo 'PASS: expired lease takeover increments epoch; stale owner cannot release'
