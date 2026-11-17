#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}"; : "${PGPORT:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGPORT" == "5432" && "$PGDATABASE" == "agent_controller_ci" && "$PGUSER" == "agent_ci" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
"${PSQL[@]}" <<'SQL'
CREATE OR REPLACE FUNCTION agent_monitor.classify_receipt_replay_ci(
 p_receipt_id text, p_incident_key text, p_digest text
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
 existing agent_monitor.receipt_replay_guard_ci%ROWTYPE;
BEGIN
 IF p_receipt_id IS NULL OR p_incident_key IS NULL OR p_digest IS NULL
    OR length(p_receipt_id)=0 OR length(p_incident_key)=0 OR length(p_digest)=0 THEN
   RETURN 'hold_invalid_input';
 END IF;
 INSERT INTO agent_monitor.receipt_replay_guard_ci(receipt_id,incident_key,payload_digest)
 VALUES (p_receipt_id,p_incident_key,p_digest)
 ON CONFLICT DO NOTHING;
 IF FOUND THEN RETURN 'accepted_new'; END IF;
 SELECT * INTO existing FROM agent_monitor.receipt_replay_guard_ci
 WHERE receipt_id=p_receipt_id OR incident_key=p_incident_key
 ORDER BY receipt_id LIMIT 1;
 IF NOT FOUND THEN RETURN 'hold_race_retry_required'; END IF;
 IF existing.receipt_id=p_receipt_id AND existing.incident_key=p_incident_key AND existing.payload_digest=p_digest THEN
   RETURN 'duplicate_identical';
 END IF;
 RETURN 'hold_conflicting_replay';
END $$;
SQL
check(){
 local actual
 actual=$("${PSQL[@]}" -c "SELECT agent_monitor.classify_receipt_replay_ci('$1','$2','$3')")
 [[ "$actual" == "$4" ]] || { echo "Unexpected replay classification: $actual expected $4" >&2; exit 1; }
}
check 'ci_classify_receipt_01' 'ci_classify_incident_01' 'digest_a' 'accepted_new'
check 'ci_classify_receipt_01' 'ci_classify_incident_01' 'digest_a' 'duplicate_identical'
check 'ci_classify_receipt_01' 'ci_classify_incident_01' 'digest_changed' 'hold_conflicting_replay'
check 'ci_classify_receipt_01' 'ci_other_incident' 'digest_a' 'hold_conflicting_replay'
check 'ci_other_receipt' 'ci_classify_incident_01' 'digest_a' 'hold_conflicting_replay'
check '' 'ci_classify_incident_02' 'digest_a' 'hold_invalid_input'
n=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.receipt_replay_guard_ci WHERE incident_key='ci_classify_incident_01'")
[[ "$n" == "1" ]] || { echo "Expected one classified receipt row, got $n" >&2; exit 1; }
echo 'PASS: identical replay recognized; changed digest or identity held as conflict'
