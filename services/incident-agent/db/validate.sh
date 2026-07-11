#!/usr/bin/env bash
# Validate ops schema migrations against pgvector-enabled PostgreSQL via Docker.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
IMAGE="${PGVECTOR_IMAGE:-pgvector/pgvector:pg16}"
CONTAINER="mogu-incident-agent-db-validate-$$"
PORT=55432

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Starting PostgreSQL ($IMAGE) on port $PORT"
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=validate \
  -e POSTGRES_DB=mogu_ops_validate \
  -p "$PORT:5432" \
  "$IMAGE" >/dev/null

echo "==> Waiting for PostgreSQL"
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d mogu_ops_validate >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

run_sql() {
  local file="$1"
  echo "    applying $(basename "$file")"
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d mogu_ops_validate <"$file"
}

run_sql "$ROOT/migrations/001_ops_schema.sql"
run_sql "$ROOT/migrations/002_budget_primitives.sql"

# Production creates these LOGIN users through Terraform I0 before applying
# role grants. Reproduce that prerequisite in the disposable database.
docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d mogu_ops_validate <<'SQL'
CREATE ROLE ops_ingest LOGIN;
CREATE ROLE ops_slack_ingress LOGIN;
CREATE ROLE ops_worker LOGIN;
CREATE ROLE ops_dispatcher LOGIN;
SQL

run_sql "$ROOT/migrations/003_ops_roles.sql"
run_sql "$ROOT/migrations/004_incident_review_gate.sql"
run_sql "$ROOT/seeds/001_sample_incidents.sql"

echo "==> Structural checks"
docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d mogu_ops_validate <<'SQL'
DO $$
BEGIN
  IF (
    SELECT COUNT(*)
      FROM information_schema.tables
     WHERE table_schema = 'ops'
       AND table_name IN (
         'incidents',
         'alert_deliveries',
         'slack_events',
         'outbox',
         'budget_usage'
       )
  ) <> 5 THEN
    RAISE EXCEPTION 'expected all five ops tables';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'pgvector extension is missing';
  END IF;

  IF (
    SELECT COUNT(*)
      FROM pg_indexes
     WHERE schemaname = 'ops'
       AND tablename = 'incidents'
       AND indexname LIKE 'incidents_open_%'
  ) <> 4 THEN
    RAISE EXCEPTION 'expected four open-incident partial indexes';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'ops.outbox'::regclass
       AND confrelid = 'ops.outbox'::regclass
  ) THEN
    RAISE EXCEPTION 'outbox depends_on self foreign key is missing';
  END IF;
END
$$;
SQL

echo "==> CHECK: github_comment requires depends_on"
set +e
docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d mogu_ops_validate -c "
INSERT INTO ops.outbox (
  incident_id, destination, idempotency_key, payload
) VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'github_comment',
  'validate:comment-without-depends',
  '{}'::jsonb
);" >/dev/null 2>&1
check_status=$?
set -e
if [ "$check_status" -eq 0 ]; then
  echo "ERROR: github_comment without depends_on should fail"
  exit 1
fi

docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d mogu_ops_validate <<'SQL'
-- Budget reservation primitive
BEGIN;
DO $$
BEGIN
  IF NOT ops.reserve_embedding_budget(100) THEN
    RAISE EXCEPTION 'embedding budget reservation unexpectedly failed';
  END IF;
  IF NOT ops.reserve_investigation_budget(50) THEN
    RAISE EXCEPTION 'investigation budget reservation unexpectedly failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM ops.budget_usage
     WHERE embedding_count = 1
       AND investigation_count = 1
  ) THEN
    RAISE EXCEPTION 'budget counters were not incremented atomically';
  END IF;
END
$$;
ROLLBACK;

DO $$
DECLARE
  nearest_other uuid;
BEGIN
  IF (
    SELECT COUNT(*)
      FROM ops.incidents
     WHERE status = 'resolved'
       AND rca_reviewed = true
       AND rca_hypothesis IS NOT NULL
       AND embedding IS NOT NULL
  ) <> 3 THEN
    RAISE EXCEPTION 'expected three reviewed seed incidents';
  END IF;

  SELECT candidate.id
    INTO nearest_other
    FROM ops.incidents AS candidate
    JOIN ops.incidents AS query
      ON query.id = 'a1000000-0000-4000-8000-000000000002'
   WHERE candidate.id <> query.id
   ORDER BY candidate.embedding <=> query.embedding
   LIMIT 1;

  IF nearest_other <> 'a1000000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'latency seed did not rank as nearest similar incident';
  END IF;

  IF NOT has_table_privilege('ops_dispatcher', 'ops.outbox', 'SELECT')
     OR has_table_privilege('ops_dispatcher', 'ops.outbox', 'INSERT')
     OR has_table_privilege('ops_dispatcher', 'ops.incidents', 'SELECT') THEN
    RAISE EXCEPTION 'dispatcher privileges are not SELECT-only on outbox';
  END IF;

  IF has_table_privilege('ops_ingest', 'ops.slack_events', 'SELECT')
     OR has_table_privilege('ops_slack_ingress', 'ops.incidents', 'SELECT')
     OR has_table_privilege('ops_worker', 'ops.alert_deliveries', 'INSERT')
     OR NOT has_table_privilege('ops_worker', 'ops.outbox', 'INSERT')
     OR has_table_privilege('ops_ingest', 'ops.budget_usage', 'UPDATE') THEN
    RAISE EXCEPTION 'component role permission matrix is incorrect';
  END IF;
END
$$;
SQL

echo "==> Validation passed"
