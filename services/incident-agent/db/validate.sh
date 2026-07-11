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
run_sql "$ROOT/migrations/003_ops_roles.sql"
run_sql "$ROOT/migrations/004_incident_review_gate.sql"
run_sql "$ROOT/seeds/001_sample_incidents.sql"

echo "==> Structural checks"
docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d mogu_ops_validate <<'SQL'
-- Tables
SELECT COUNT(*) AS table_count
  FROM information_schema.tables
 WHERE table_schema = 'ops'
   AND table_name IN ('incidents', 'alert_deliveries', 'slack_events', 'outbox', 'budget_usage');

-- pgvector extension
SELECT extname FROM pg_extension WHERE extname = 'vector';

-- Partial unique indexes exist
SELECT indexname
  FROM pg_indexes
 WHERE schemaname = 'ops'
   AND tablename = 'incidents'
   AND indexname LIKE 'incidents_open_%';

-- outbox depends_on self-FK
SELECT conname
  FROM pg_constraint
 WHERE conrelid = 'ops.outbox'::regclass
   AND confrelid = 'ops.outbox'::regclass;
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
SELECT ops.reserve_embedding_budget(100) AS reserved_embedding;
SELECT ops.reserve_investigation_budget(50) AS reserved_investigation;
SELECT embedding_count, investigation_count FROM ops.budget_usage;
ROLLBACK;

-- Seed incidents eligible for search_similar_incidents
SELECT COUNT(*) AS reviewed_resolved_with_embedding
  FROM ops.incidents
 WHERE status = 'resolved'
   AND rca_reviewed = true
   AND rca_hypothesis IS NOT NULL
   AND embedding IS NOT NULL;

-- Vector similarity: latency seeds should rank above SQL incident
WITH query AS (
  SELECT embedding FROM ops.incidents
   WHERE id = 'a1000000-0000-4000-8000-000000000002'
)
SELECT i.id,
       1 - (i.embedding <=> q.embedding) AS cosine_similarity
  FROM ops.incidents i, query q
 WHERE i.status = 'resolved'
   AND i.rca_reviewed = true
   AND i.rca_hypothesis IS NOT NULL
   AND i.embedding IS NOT NULL
 ORDER BY i.embedding <=> q.embedding
 LIMIT 3;

-- Role grants: dispatcher SELECT-only on outbox
SELECT has_table_privilege('ops_dispatcher', 'ops.outbox', 'SELECT') AS dispatcher_select,
       has_table_privilege('ops_dispatcher', 'ops.outbox', 'INSERT') AS dispatcher_insert,
       has_table_privilege('ops_dispatcher', 'ops.incidents', 'SELECT') AS dispatcher_incidents;

-- Cross-role deny samples
SELECT has_table_privilege('ops_ingest', 'ops.slack_events', 'SELECT') AS ingest_slack_events,
       has_table_privilege('ops_slack_ingress', 'ops.incidents', 'SELECT') AS slack_incidents,
       has_table_privilege('ops_worker', 'ops.alert_deliveries', 'INSERT') AS worker_alert_insert,
       has_table_privilege('ops_worker', 'ops.outbox', 'INSERT') AS worker_outbox_insert,
       has_table_privilege('ops_ingest', 'ops.budget_usage', 'UPDATE') AS ingest_budget_update;
SQL

echo "==> Validation passed"
