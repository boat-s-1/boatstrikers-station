-- DESIGN DRAFT ONLY: DO NOT EXECUTE IN PRODUCTION.
-- Requires explicit approval, review of schema/RLS, role grants, retention and cost.
-- Not included in migrations or CI execution.
BEGIN;
CREATE SCHEMA IF NOT EXISTS agent_monitor;
CREATE TABLE agent_monitor.attempt_events (
 event_id uuid PRIMARY KEY,
 attempt_id uuid NOT NULL,
 event_at timestamptz NOT NULL,
 event_kind text NOT NULL CHECK (event_kind IN ('attempt','result','incident','delivery','recovery')),
 status_code text NOT NULL CHECK (status_code IN ('ok','timeout','connection_error','permission_denied','invalid_result','policy_hold','unknown')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX attempt_events_one_start ON agent_monitor.attempt_events(attempt_id) WHERE event_kind='attempt';
CREATE TABLE agent_monitor.incident_reservations (
 incident_key text PRIMARY KEY CHECK (incident_key ~ '^[A-Za-z0-9_-]{8,80}$'),
 attempt_id uuid NOT NULL,
 reservation_state text NOT NULL CHECK (reservation_state IN ('reserved','delivered','failed')),
 reserved_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE agent_monitor.notification_outbox (
 outbox_id uuid PRIMARY KEY,
 incident_key text NOT NULL REFERENCES agent_monitor.incident_reservations(incident_key),
 reason text NOT NULL CHECK (reason IN ('timeout','connection_error','permission_denied','invalid_result','policy_hold')),
 delivery_state text NOT NULL CHECK (delivery_state IN ('pending_review','approved','delivered','failed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX notification_outbox_one_per_incident ON agent_monitor.notification_outbox(incident_key);
ALTER TABLE agent_monitor.attempt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_monitor.incident_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_monitor.notification_outbox ENABLE ROW LEVEL SECURITY;
-- No policies or grants in this draft. Privileged role bypass and schema permissions
-- require separate security review. No trigger, Cron, or auto-delete is defined.
ROLLBACK;
