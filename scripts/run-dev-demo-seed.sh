#!/usr/bin/env bash
# Apply migrations (optional) and demo seed on dev Cloud SQL (#46).
# Requires: gcloud auth, Cloud Run Job dev-db-migrate image with seed support.
set -euo pipefail

PROJECT="${GCP_PROJECT:-mogu-501309}"
REGION="${GCP_REGION:-asia-northeast1}"
JOB="${MIGRATE_JOB:-dev-db-migrate}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Build migrate/seed image"
gcloud builds submit "${ROOT}/apps/web" \
  --project="${PROJECT}" \
  --config="${ROOT}/apps/web/cloudbuild.migrate.yaml"

DB_HOST="$(gcloud sql instances describe dev-pg --project="${PROJECT}" \
  --format='value(ipAddresses[0].ipAddress)')"

echo "==> Deploy migrate job (image updated)"
gcloud run jobs deploy "${JOB}" \
  --project="${PROJECT}" --region="${REGION}" \
  --image="asia-northeast1-docker.pkg.dev/${PROJECT}/web/migrate:latest" \
  --service-account="dev-web-run@${PROJECT}.iam.gserviceaccount.com" \
  --network=dev-vpc --subnet=dev-subnet --vpc-egress=private-ranges-only \
  --set-secrets=DB_PASSWORD=dev-db-password:latest \
  --set-env-vars="DB_HOST=${DB_HOST},DB_USER=app_user,DB_NAME=app,RUN_DEMO_SEED=false" \
  --tasks=1 --max-retries=0 --task-timeout=10m

echo "==> Apply migrations"
gcloud run jobs execute "${JOB}" \
  --project="${PROJECT}" --region="${REGION}" --wait

echo "==> Seed demo data"
gcloud run jobs update "${JOB}" \
  --project="${PROJECT}" --region="${REGION}" \
  --set-env-vars="DB_HOST=${DB_HOST},DB_USER=app_user,DB_NAME=app,RUN_DEMO_SEED=true"

gcloud run jobs execute "${JOB}" \
  --project="${PROJECT}" --region="${REGION}" --wait

gcloud run jobs update "${JOB}" \
  --project="${PROJECT}" --region="${REGION}" \
  --set-env-vars="DB_HOST=${DB_HOST},DB_USER=app_user,DB_NAME=app,RUN_DEMO_SEED=false"

echo "PASS: dev demo seed completed"
