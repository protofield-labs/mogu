# Terraform AI Harness (Google Cloud) + Next.js

This repository is a Terraform AI Harness for Google Cloud, combined with
a Next.js application in a single monorepo.

It provides rules, scripts, and skills so that AI Agents and humans can
work with Terraform and application code safely.

## Standard Pattern

The standard sample pattern assumes:

- 1 Google Cloud project (`mogu-501309`)
- Primary region: `asia-northeast1`
- Public access
- Cloud Run v2 (application)
- Cloud SQL for PostgreSQL 18 (private IP only)
- Cloud Storage
- Secret Manager

## Repository Layout

- `terraform/` is for actual Terraform implementation code (apply target).
  - `terraform/modules/` holds reusable child modules.
  - `terraform/environments/dev/` is the dev root module.
- `apps/web/` is the Next.js (App Router) application.
- `scripts/` is for local and CI-compatible utility scripts.

## Rules

Rules are layered (nearest file wins):

- `AGENTS.md` is the always-on repository-wide rule summary.
- `terraform/AGENTS.md` holds infrastructure rules (maintenance mode).
- `apps/web/AGENTS.md` holds application rules (development mode).
- `.agents/skills/terraform-project-guidelines/references/` holds the
  detailed Terraform rules (layout, module design, state boundaries,
  backend, cross-state values, execution policy).

## Tool Versions

Pinned in `.tool-versions`:

- Terraform 1.15.7
- TFLint 0.63.1
- Trivy 0.72.0

Other pins:

- google provider 7.39.0 (`terraform/environments/dev/versions.tf`)
- tflint-ruleset-google 0.39.0 (`.tflint.hcl`)
- Node.js 24.18.0, pnpm 11.9.0, Next.js 16.2.10 (`apps/web/`)

## Getting Started

### 1. Bootstrap the state bucket (once, manually)

The Terraform state bucket is managed outside the root modules. Create it
before the first `terraform init`:

```bash
gcloud storage buckets create gs://tfstate-mogu \
  --project=mogu-501309 \
  --location=asia-northeast1 \
  --uniform-bucket-level-access

gcloud storage buckets update gs://tfstate-mogu --versioning
```

### 2. Terraform

```bash
cd terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars   # then edit values
terraform init
```

Use the harness scripts for plan and checks:

```bash
./scripts/check.sh terraform/environments/dev
./scripts/plan.sh terraform/environments/dev
```

`terraform apply` requires human approval (see `terraform/AGENTS.md`).

### 3. Next.js deploy (GitHub Actions)

Pushes to `main` that touch `apps/web/` trigger
`.github/workflows/deploy-web.yml`:

1. Authenticate to GCP via Workload Identity Federation (no SA keys).
2. Build the container on `ubuntu-latest` (native amd64).
3. Push to Artifact Registry tagged with the commit SHA (and `latest`).
4. Update the Cloud Run service with `gcloud run services update`.

One-time setup: apply the Terraform in `terraform/environments/dev/` so the
WIF pool, CI service account, and Artifact Registry cleanup policy exist.
Then confirm the workflow env vars match `terraform output`:

```bash
terraform output github_actions_workload_identity_provider
terraform output github_actions_service_account
```

Manual build/push (fallback only):

```bash
REGION=asia-northeast1
PROJECT=mogu-501309
REPO=web
IMAGE=${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/web:latest

gcloud auth configure-docker ${REGION}-docker.pkg.dev
docker build -t ${IMAGE} apps/web
docker push ${IMAGE}
```

### 4. Connecting to Cloud SQL locally (optional)

Cloud SQL uses a private IP only. To reach it from your machine, use the
Cloud SQL Auth Proxy:

```bash
cloud-sql-proxy --private-ip mogu-501309:asia-northeast1:<instance-name>
```

### 5. Monitoring alerts (Slack)

Cloud Monitoring alert policies (Cloud Run 5xx / latency / request spike,
Cloud SQL CPU / disk) notify Slack via a Monitoring notification channel.
Billing budget alerts use email by default; optional Slack forwarding uses
Pub/Sub + Cloud Function (see below).

One-time setup (Monitoring):

1. GCP Console → **Monitoring → Alerting → Edit notification channels → Slack**
2. Authorize your workspace and pick a channel (e.g. `#mogu-lab`)
3. Copy the channel ID:

```bash
gcloud monitoring channels list \
  --project=mogu-501309 \
  --filter='type="slack"' \
  --format='value(name)'
```

4. Set `slack_notification_channel_id` in `terraform.tfvars` and apply.

Budget → Slack (optional, issue #10):

1. Create a Slack **Incoming Webhook** for `#mogu-lab` (Slack app settings).
2. Set `slack_budget_webhook_url` in `terraform.tfvars` and apply.
3. Send a test notification:

```bash
chmod +x scripts/test-budget-slack.sh
./scripts/test-budget-slack.sh
```

Budget thresholds: actual spend at 20/50/80/100% and forecast at 100%.

Alerts stay within Cloud Monitoring free tier (no Datadog / custom metrics).

## Cost Notes

- Cloud SQL: `db-f1-micro`-class tier, `ZONAL` (no HA) to keep dev cheap.
- `deletion_protection` defaults to `false` in dev so the instance can be
  recreated. WARNING: with protection disabled, the instance and its data
  can be destroyed by a replace/apply. Do not use this default in prod.
- Cloud Run scales to zero (`min_instance_count = 0`).
- All resources live in `asia-northeast1` to avoid cross-region egress.

## Required Tools

- Terraform
- TFLint
- Trivy
- jq (used by the Cursor shell hook and `scripts/plan.sh`)
- Node.js + pnpm (for `apps/web`)
