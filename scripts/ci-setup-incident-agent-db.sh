#!/usr/bin/env bash
# Apply incident-agent ops schema migrations for CI (#362).
# Connects as the default postgres superuser against a pgvector-enabled database.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../services/incident-agent/db" && pwd)"

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
PGDATABASE="${PGDATABASE:-mogu_test}"

export PGPASSWORD

psql_base=(psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -v ON_ERROR_STOP=1)

run_sql() {
  local file="$1"
  echo "Applying $(basename "${file}")"
  "${psql_base[@]}" -d "${PGDATABASE}" -f "${file}"
}

run_sql "${ROOT}/migrations/001_ops_schema.sql"
run_sql "${ROOT}/migrations/002_budget_primitives.sql"

# Terraform I0 creates LOGIN roles before 003_ops_roles.sql in production.
"${psql_base[@]}" -d "${PGDATABASE}" <<'SQL'
DO $$ BEGIN CREATE ROLE ops_ingest LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE ops_slack_ingress LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE ops_worker LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE ops_dispatcher LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE ops_operator LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE ops_reviewer LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
SQL

for migration in 003_ops_roles.sql 004_incident_review_gate.sql 005_outbox_delivery_token.sql 006_slack_retention_grants.sql; do
  run_sql "${ROOT}/migrations/${migration}"
done

echo "incident-agent ops schema ready on ${PGDATABASE}"
