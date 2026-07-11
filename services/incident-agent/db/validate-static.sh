#!/usr/bin/env bash
# Static checks when PostgreSQL/Docker is unavailable.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

required_files=(
  migrations/001_ops_schema.sql
  migrations/002_budget_primitives.sql
  migrations/003_ops_roles.sql
  migrations/004_incident_review_gate.sql
  seeds/001_sample_incidents.sql
  README.md
)

for f in "${required_files[@]}"; do
  [[ -f "$f" ]] || { echo "missing: $f"; exit 1; }
done

grep -q 'CREATE EXTENSION IF NOT EXISTS vector' migrations/001_ops_schema.sql
grep -q 'CREATE SCHEMA IF NOT EXISTS ops' migrations/001_ops_schema.sql
grep -q 'CREATE TABLE ops.incidents' migrations/001_ops_schema.sql
grep -q 'CREATE TABLE ops.alert_deliveries' migrations/001_ops_schema.sql
grep -q 'CREATE TABLE ops.slack_events' migrations/001_ops_schema.sql
grep -q 'CREATE TABLE ops.outbox' migrations/001_ops_schema.sql
grep -q 'CREATE TABLE ops.budget_usage' migrations/001_ops_schema.sql
grep -q 'vector(768)' migrations/001_ops_schema.sql
grep -q 'incidents_open_incident_key' migrations/001_ops_schema.sql
grep -q 'depends_on      uuid REFERENCES ops.outbox(id)' migrations/001_ops_schema.sql
grep -q 'dispatch_generation' migrations/001_ops_schema.sql
grep -q "destination NOT IN ('github_comment', 'github_close') OR depends_on IS NOT NULL" migrations/001_ops_schema.sql
grep -q 'reserve_embedding_budget' migrations/002_budget_primitives.sql
grep -q 'reserve_investigation_budget' migrations/002_budget_primitives.sql
grep -q 'ops_ingest' migrations/003_ops_roles.sql
grep -q 'ops_slack_ingress' migrations/003_ops_roles.sql
grep -q 'ops_worker' migrations/003_ops_roles.sql
grep -q 'ops_dispatcher' migrations/003_ops_roles.sql
grep -q 'Required Terraform-managed database roles do not exist' migrations/003_ops_roles.sql
if grep -Eq 'CREATE ROLE ops_(ingest|slack_ingress|worker|dispatcher)' migrations/003_ops_roles.sql; then
  echo "runtime LOGIN roles must be created by Terraform, not migrations"
  exit 1
fi
grep -q 'rca_reviewed' seeds/001_sample_incidents.sql

echo "PASS: static SQL structure checks"
