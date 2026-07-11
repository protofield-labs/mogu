-- I1: DB-enforced RCA review gate (§5, §10)
-- Runtime roles (ops_ingest, ops_worker) cannot set or change human-review fields.
-- ops_reviewer role for review_incident CLI is introduced in I4.

CREATE OR REPLACE FUNCTION ops.enforce_incident_review_gate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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

CREATE TRIGGER incidents_review_gate
  BEFORE INSERT OR UPDATE ON ops.incidents
  FOR EACH ROW
  EXECUTE FUNCTION ops.enforce_incident_review_gate();

COMMENT ON FUNCTION ops.enforce_incident_review_gate() IS
  'Blocks ops_ingest and ops_worker from bypassing the human RCA review gate.';
