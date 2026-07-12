-- I4: stale-worker protection and operator-only RCA review role.
ALTER TABLE ops.outbox
  ADD COLUMN IF NOT EXISTS delivery_token uuid NOT NULL DEFAULT gen_random_uuid();

DO $$
DECLARE
  missing_roles text;
BEGIN
  SELECT string_agg(required_role, ', ' ORDER BY required_role)
    INTO missing_roles
    FROM unnest(ARRAY['ops_operator', 'ops_reviewer']) AS roles(required_role)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_roles WHERE rolname = required_role
   );
  IF missing_roles IS NOT NULL THEN
    RAISE EXCEPTION
      'Required Terraform-managed I4 database roles do not exist: %',
      missing_roles;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA ops TO ops_operator;
GRANT SELECT ON ops.outbox TO ops_operator;
GRANT UPDATE (
  status,
  attempt_count,
  lease_expires_at,
  dispatch_generation,
  delivery_token
) ON ops.outbox TO ops_operator;
REVOKE ALL ON ops.incidents FROM ops_operator;
REVOKE ALL ON ops.alert_deliveries FROM ops_operator;
REVOKE ALL ON ops.slack_events FROM ops_operator;
REVOKE ALL ON ops.budget_usage FROM ops_operator;

GRANT USAGE ON SCHEMA ops TO ops_reviewer;
GRANT SELECT ON ops.incidents TO ops_reviewer;
GRANT UPDATE (
  status,
  resolved_at,
  rca_hypothesis,
  rca_reviewed,
  reviewed_at,
  reviewed_by,
  investigation_token,
  lease_expires_at
) ON ops.incidents TO ops_reviewer;
REVOKE ALL ON ops.alert_deliveries FROM ops_reviewer;
REVOKE ALL ON ops.slack_events FROM ops_reviewer;
REVOKE ALL ON ops.outbox FROM ops_reviewer;
REVOKE ALL ON ops.budget_usage FROM ops_reviewer;

CREATE OR REPLACE FUNCTION ops.enforce_incident_review_gate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF pg_has_role(current_user, 'ops_reviewer', 'member') THEN
    RETURN NEW;
  END IF;

  IF pg_has_role(current_user, 'ops_ingest', 'member')
     OR pg_has_role(current_user, 'ops_worker', 'member') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.rca_reviewed IS TRUE
         OR NEW.reviewed_at IS NOT NULL
         OR NEW.reviewed_by IS NOT NULL THEN
        RAISE EXCEPTION 'runtime roles cannot set review fields on insert';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.rca_reviewed IS DISTINCT FROM OLD.rca_reviewed
         OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
         OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
        RAISE EXCEPTION 'runtime roles cannot modify review fields';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
