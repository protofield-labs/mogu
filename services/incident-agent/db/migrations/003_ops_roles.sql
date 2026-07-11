-- I1: component-scoped DB roles (§7-11, §14, §15 I1)
-- Minimal grants per service; cross-table escalation is denied by omission.
-- Terraform I0 owns creation and passwords for these LOGIN roles. Keeping
-- role creation out of SQL avoids duplicate ownership between Terraform and
-- the migration.

DO $$
DECLARE
  missing_roles text;
BEGIN
  SELECT string_agg(required_role, ', ' ORDER BY required_role)
    INTO missing_roles
    FROM unnest(ARRAY[
      'ops_ingest',
      'ops_slack_ingress',
      'ops_worker',
      'ops_dispatcher'
    ]) AS roles(required_role)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_roles WHERE rolname = required_role
   );

  IF missing_roles IS NOT NULL THEN
    RAISE EXCEPTION
      'Required Terraform-managed database roles do not exist: %',
      missing_roles;
  END IF;
END
$$;

REVOKE ALL ON SCHEMA ops FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA ops FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ops FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- ops_ingest — Pub/Sub ingest (I2)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA ops TO ops_ingest;

GRANT SELECT, INSERT, UPDATE ON ops.incidents TO ops_ingest;
REVOKE UPDATE (rca_reviewed, reviewed_at, reviewed_by) ON ops.incidents FROM ops_ingest;
GRANT SELECT, INSERT, UPDATE ON ops.alert_deliveries TO ops_ingest;
GRANT SELECT, INSERT ON ops.outbox TO ops_ingest;
GRANT SELECT ON ops.budget_usage TO ops_ingest;

GRANT EXECUTE ON FUNCTION ops.ensure_budget_row(date) TO ops_ingest;
GRANT EXECUTE ON FUNCTION ops.reserve_embedding_budget(int) TO ops_ingest;
GRANT EXECUTE ON FUNCTION ops.reserve_investigation_budget(int) TO ops_ingest;

-- Explicit deny: slack_events
REVOKE ALL ON TABLE ops.slack_events FROM ops_ingest;

-- ---------------------------------------------------------------------------
-- ops_slack_ingress — Slack Events ingress (I6)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA ops TO ops_slack_ingress;

GRANT SELECT, INSERT, UPDATE ON ops.slack_events TO ops_slack_ingress;

REVOKE ALL ON TABLE ops.incidents FROM ops_slack_ingress;
REVOKE ALL ON TABLE ops.alert_deliveries FROM ops_slack_ingress;
REVOKE ALL ON TABLE ops.outbox FROM ops_slack_ingress;
REVOKE ALL ON TABLE ops.budget_usage FROM ops_slack_ingress;

-- ---------------------------------------------------------------------------
-- ops_worker — Cloud Tasks worker (I4, I6)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA ops TO ops_worker;

GRANT SELECT, UPDATE ON ops.incidents TO ops_worker;
REVOKE UPDATE (rca_reviewed, reviewed_at, reviewed_by) ON ops.incidents FROM ops_worker;
GRANT SELECT, INSERT, UPDATE ON ops.outbox TO ops_worker;
GRANT SELECT, UPDATE ON ops.slack_events TO ops_worker;
GRANT SELECT ON ops.budget_usage TO ops_worker;

GRANT EXECUTE ON FUNCTION ops.ensure_budget_row(date) TO ops_worker;
GRANT EXECUTE ON FUNCTION ops.reserve_embedding_budget(int) TO ops_worker;
GRANT EXECUTE ON FUNCTION ops.reserve_investigation_budget(int) TO ops_worker;

REVOKE ALL ON TABLE ops.alert_deliveries FROM ops_worker;

-- ---------------------------------------------------------------------------
-- ops_dispatcher — outbox dispatcher Job (I4)
-- Eligible-row SELECT only; no DML, no budget/incident access.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA ops TO ops_dispatcher;

GRANT SELECT ON ops.outbox TO ops_dispatcher;

REVOKE ALL ON TABLE ops.incidents FROM ops_dispatcher;
REVOKE ALL ON TABLE ops.alert_deliveries FROM ops_dispatcher;
REVOKE ALL ON TABLE ops.slack_events FROM ops_dispatcher;
REVOKE ALL ON TABLE ops.budget_usage FROM ops_dispatcher;

REVOKE INSERT, UPDATE, DELETE ON TABLE ops.outbox FROM ops_dispatcher;

REVOKE EXECUTE ON FUNCTION ops.ensure_budget_row(date) FROM ops_dispatcher;
REVOKE EXECUTE ON FUNCTION ops.reserve_embedding_budget(int) FROM ops_dispatcher;
REVOKE EXECUTE ON FUNCTION ops.reserve_investigation_budget(int) FROM ops_dispatcher;

-- Default privileges: new objects stay locked down for PUBLIC
ALTER DEFAULT PRIVILEGES IN SCHEMA ops REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops REVOKE ALL ON FUNCTIONS FROM PUBLIC;
