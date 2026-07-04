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

**PR plan CI** (`.github/workflows/terraform-check.yml`):

Pull requests that touch `terraform/**` run `check.sh` and a read-only
`terraform plan` against the GCS backend. Delete/replace actions fail the
job (`PLAN_STRICT=true`). A sanitized summary is posted as a PR comment.

One-time setup after applying the plan service account in Terraform:

```bash
terraform output github_actions_plan_service_account
terraform output github_actions_workload_identity_provider
```

Configure this **GitHub repository secret** (Settings → Secrets → Actions):

| Secret | Purpose |
|--------|---------|
| `TF_VAR_slack_budget_webhook_url` | Budget → Slack webhook (must match state or plan shows spurious deletes) |

Optional secrets (leave unset if unused):

| Secret | Purpose |
|--------|---------|
| `TF_VAR_slack_auth_token` | Monitoring Slack OAuth (prefer channel ID in workflow env) |
| `TF_VAR_slack_budget_bot_token` | Budget Slack bot token (webhook alternative) |

Non-secret dev defaults (`project_id`, `billing_account_id`, `enable_db_connection`, etc.)
are set in the workflow env. Update workflow env if dev defaults change.

Apply Terraform locally once to create `dev-github-actions-plan@...` and state
bucket IAM before the plan job can succeed:

```bash
./scripts/plan.sh terraform/environments/dev
# review, then apply with human approval
```

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

Cloud SQL uses a private IP only. The Auth Proxy with `--private-ip` requires
your machine to have network connectivity to the VPC (VPN or a host inside
the VPC). Without that, use a Cloud Run Job with Direct VPC egress (see §5).

```bash
cloud-sql-proxy --private-ip mogu-501309:asia-northeast1:dev-pg --port 5432
```

### 5. Database migrations (Prisma)

Schema and migrations live in `apps/web/prisma/`. The `users` table uses
`firebase_uid` as the primary key with PostgreSQL RLS (`FORCE ROW LEVEL
SECURITY`, `self_only` policy). Migrations run as `app_user`, the same
role the application uses, so RLS applies during verification.

**Apply migrations to dev** (Auth Proxy on port 5432, with VPC connectivity):

```bash
export DB_PASSWORD="$(gcloud secrets versions access latest \
  --secret=dev-db-password --project=mogu-501309)"
export DATABASE_URL="postgresql://app_user:${DB_PASSWORD}@127.0.0.1:5432/app"

cd apps/web
pnpm db:migrate
```

**Or run from Cloud Run Job** (works without local VPC access):

```bash
# Build the migrate image once
gcloud builds submit apps/web \
  --project=mogu-501309 \
  --config=apps/web/cloudbuild.migrate.yaml

# Private IP can change if the instance is recreated; always look it up.
DB_HOST="$(gcloud sql instances describe dev-pg --project=mogu-501309 \
  --format='value(ipAddresses[0].ipAddress)')"

gcloud run jobs deploy dev-db-migrate \
  --project=mogu-501309 --region=asia-northeast1 \
  --image=asia-northeast1-docker.pkg.dev/mogu-501309/web/migrate:latest \
  --service-account=dev-web-run@mogu-501309.iam.gserviceaccount.com \
  --network=dev-vpc --subnet=dev-subnet --vpc-egress=private-ranges-only \
  --set-secrets=DB_PASSWORD=dev-db-password:latest \
  --set-env-vars=DB_HOST=${DB_HOST},DB_USER=app_user,DB_NAME=app \
  --tasks=1 --max-retries=0 --task-timeout=10m

gcloud run jobs execute dev-db-migrate \
  --project=mogu-501309 --region=asia-northeast1 --wait
```

Copy `apps/web/.env.example` to `apps/web/.env` for local `pnpm dev` if needed.

**Verify RLS** (uses `app_user`, not the Cloud SQL admin):

```bash
export DATABASE_URL="postgresql://app_user:${DB_PASSWORD}@127.0.0.1:5432/app"
chmod +x scripts/verify-users-rls.sh
./scripts/verify-users-rls.sh
```

Application code sets the RLS session variable via `withRls()` in
`apps/web/src/lib/db/rls.ts`.

### 6. Authentication (Firebase)

Firebase Authentication (Email/Password + Google) with Bearer tokens on Route
Handlers. Admin SDK uses ADC on Cloud Run (no service account keys). UI pages
(`/login`, `/signup`) are tracked in #17; this section covers infrastructure
and local verification.

**Provision Firebase (Terraform)**:

Firebase APIs require a dedicated Terraform service account (SA impersonation)
and ADC quota project. First-time setup also requires accepting the Firebase
Terms of Service in the browser (one-time).

```bash
# From repo root (sets quota project, applies Terraform, optional gh secret sync)
./scripts/bootstrap-firebase.sh
```

If `google_firebase_project` returns 403, open
https://console.firebase.google.com/project/mogu-501309/overview ,
accept the Firebase ToS, then re-run the script.

Set `terraform_firebase_impersonators` in `terraform.tfvars` to your GCP user
(`user:you@example.com`). Run `gcloud auth application-default login` with the
same account before apply.

After apply, copy Web SDK config into `apps/web/.env` (from `.env.example`):

```bash
terraform -chdir=terraform/environments/dev output -json firebase_web_config
# Or sync deploy secrets:
./scripts/sync-firebase-github-secrets.sh
```

Enable **Google** sign-in in [Firebase Console → Authentication → Sign-in
method](https://console.firebase.google.com/) (same GCP project), or set
`google_oauth_client_id` / `google_oauth_client_secret` in `terraform.tfvars`.
Email/Password is enabled by Terraform.

**Local dev with Auth Emulator** (no GCP Auth traffic):

```bash
# Terminal 1: Auth Emulator (requires Firebase CLI)
firebase emulators:start --only auth --project demo-mogu

# Terminal 2: app (use emulator vars from apps/web/.env.example)
cd apps/web && pnpm dev
```

Set `FIREBASE_AUTH_EMULATOR_HOST` (server) and
`NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` (client) to `127.0.0.1:9099`.

**Protected API routes** (`Authorization: Bearer <Firebase ID token>`):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/users/provision` | Idempotent user row create (`displayName`) |
| GET | `/api/v1/users/me` | Current user's row (404 if not provisioned) |

Public: `/api/health/*` only. Client helpers: `authFetch()`, `useAuth()` in
`apps/web/src/lib/auth/` and `apps/web/src/contexts/auth-context.tsx`.

**Deploy build-time Firebase config**: `NEXT_PUBLIC_FIREBASE_*` must be passed
as Docker build args (see `apps/web/Dockerfile`). Set GitHub repository secrets
from `terraform output firebase_web_config` before the first auth-enabled deploy.

### 7. Monitoring alerts (Slack)

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
Duplicate alerts for the same threshold in a billing period are suppressed
(GCS-backed dedupe state; Slack credentials stay in Secret Manager).
If both `slack_budget_webhook_url` and `slack_budget_bot_token` are set,
the webhook takes precedence.

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
