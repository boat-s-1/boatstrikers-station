#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}"; : "${PGPORT:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGPORT" == "5432" && "$PGDATABASE" == "agent_controller_ci" && "$PGUSER" == "agent_ci" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
"${PSQL[@]}" <<'SQL'
CREATE TABLE agent_monitor.receipt_conflict_audit_ci (
 audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 receipt_id text NOT NULL,
 incident_key text NOT NULL,
 conflict_reason text NOT NULL CHECK (conflict_reason IN ('receipt_or_incident_mismatch','payload_digest_mismatch')),
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION agent_monitor.audit_receipt_replay_ci(
 p_receipt_id text, p_incident_key text, p_digest text
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
 prior agent_monitor.receipt_replay_guard_ci%ROWTYPE;
 decision text;
BEGIN
 decision := agent_monitor.classify_receipt_replay_ci(p_receipt_id,p_incident_key,p_digest);
 IF decision <> 'hold_conflicting_replay' THEN RETURN decision; END IF;
 SELECT * INTO prior FROM agent_monitor.receipt_replay_guard_ci
 WHERE receipt_id=p_receipt_id OR incident_key=p_incident_key
 ORDER BY receipt_id LIMIT 1;
 IF NOT FOUND THEN RETURN 'hold_race_retry_required'; END IF;
 INSERT INTO agent_monitor.receipt_conflict_audit_ci(receipt_id,incident_key,conflict_reason)
 VALUES (p_receipt_id,p_incident_key,
  CASE WHEN prior.receipt_id=p_receipt_id AND prior.incident_key=p_incident_key
   THEN 'payload_digest_mismatch' ELSE 'receipt_or_incident_mismatch' END);
 RETURN decision;
END $$;
SQL
check(){
 local actual
 actual=$("${PSQL[@]}" -c "SELECT agent_monitor.audit_receipt_replay_ci('$1','$2','$3')")
 [[ "$actual" == "$4" ]] || { echo "Unexpected audited replay classification: $actual expected $4" >&2; exit 1; }
}
check 'ci_audit_receipt_01' 'ci_audit_incident_01' 'digest_a' 'accepted_new'
check 'ci_audit_receipt_01' 'ci_audit_incident_01' 'digest_a' 'duplicate_identical'
check 'ci_audit_receipt_01' 'ci_audit_incident_01' 'digest_changed' 'hold_conflicting_replay'
check 'ci_audit_receipt_01' 'ci_other_incident' 'digest_a' 'hold_conflicting_replay'
check 'ci_other_receipt' 'ci_audit_incident_01' 'digest_a' 'hold_conflicting_replay'
n=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.receipt_conflict_audit_ci")
[[ "$n" == "3" ]] || { echo "Expected 3 conflict audit rows, got $n" >&2; exit 1; }
n=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.receipt_conflict_audit_ci WHERE conflict_reason='payload_digest_mismatch'")
[[ "$n" == "1" ]] || { echo "Expected one digest mismatch audit, got $n" >&2; exit 1; }
n=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.receipt_replay_guard_ci WHERE incident_key='ci_audit_incident_01'")
[[ "$n" == "1" ]] || { echo "Expected one original receipt row, got $n" >&2; exit 1; }
echo 'PASS: conflicting replays durably audited in disposable DB, identical replay not audited'
