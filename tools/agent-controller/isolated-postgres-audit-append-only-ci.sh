#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}"; : "${PGPORT:?}"; : "${PGDATABASE:?}"; : "${PGUSER:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGPORT" == "5432" && "$PGDATABASE" == "agent_controller_ci" && "$PGUSER" == "agent_ci" ]] || { echo 'Refusing non-CI target' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt)
"${PSQL[@]}" <<'SQL'
CREATE OR REPLACE FUNCTION agent_monitor.prevent_receipt_audit_mutation_ci()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'receipt conflict audit is append-only';
END $$;
CREATE TRIGGER receipt_audit_append_only_ci
BEFORE UPDATE OR DELETE ON agent_monitor.receipt_conflict_audit_ci
FOR EACH ROW EXECUTE FUNCTION agent_monitor.prevent_receipt_audit_mutation_ci();
SQL
before=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.receipt_conflict_audit_ci")
[[ "$before" == "3" ]] || { echo "Unexpected audit fixture count $before" >&2; exit 1; }
if "${PSQL[@]}" -c "UPDATE agent_monitor.receipt_conflict_audit_ci SET conflict_reason='payload_digest_mismatch' WHERE audit_id=(SELECT min(audit_id) FROM agent_monitor.receipt_conflict_audit_ci)" >/dev/null 2>&1; then
 echo 'Audit UPDATE unexpectedly allowed' >&2; exit 1
fi
if "${PSQL[@]}" -c "DELETE FROM agent_monitor.receipt_conflict_audit_ci WHERE audit_id=(SELECT min(audit_id) FROM agent_monitor.receipt_conflict_audit_ci)" >/dev/null 2>&1; then
 echo 'Audit DELETE unexpectedly allowed' >&2; exit 1
fi
after=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.receipt_conflict_audit_ci")
[[ "$after" == "$before" ]] || { echo "Audit row count changed: $after" >&2; exit 1; }
"${PSQL[@]}" -c "INSERT INTO agent_monitor.receipt_conflict_audit_ci(receipt_id,incident_key,conflict_reason) VALUES ('ci_append_receipt','ci_append_incident','payload_digest_mismatch')"
after=$("${PSQL[@]}" -c "SELECT count(*) FROM agent_monitor.receipt_conflict_audit_ci")
[[ "$after" == "4" ]] || { echo "Append was not allowed: $after" >&2; exit 1; }
echo 'PASS: ordinary audit UPDATE/DELETE rejected; append accepted in disposable DB'
