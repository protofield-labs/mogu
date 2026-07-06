# Terraform Infrastructure Rules (Maintenance Mode)

These rules apply to everything under `terraform/`. They extend the
repository-wide `AGENTS.md`; when more specific, these win.

This is maintenance mode: infrastructure is real and changes are risky.
The human steers, the agent executes.

## Apply and Safety

- After `scripts/plan.sh`, the agent may run `terraform apply` in the target
  root module directory. Do not add `terraform apply` to CI workflows.
- Do not run `terraform destroy`.
- Do not run `terraform state` commands.
- Do not run `terraform force-unlock`.
- Do not run `terraform workspace` commands.
- Do not use `-destroy`, `-replace`, `-target`, or `--target` with
  `terraform plan` or `terraform apply`.
- Use `scripts/plan.sh <root-module-dir>` to review changes.
- Run `scripts/check.sh <target-dir>` before reporting completion.

## Google Cloud Conventions

- Cloud Run must use `google_cloud_run_v2_service` (v2). v1
  (`google_cloud_run_service`) is forbidden.
- Cloud SQL uses private IP only (`ipv4_enabled = false`) via Private
  Service Access (`google_compute_global_address` +
  `google_service_networking_connection` + instance `private_network`).
- Cloud Run to Cloud SQL uses Direct VPC egress (`vpc_access` /
  `network_interfaces`). Do not use the legacy Serverless VPC Access
  Connector.
- Create a dedicated service account for Cloud Run. Do not use the default
  Compute service account.
- Enable required APIs explicitly with `google_project_service`.

## Secrets

- Never hardcode sensitive values.
- Store secrets in Secret Manager.
- Inject secrets into Cloud Run with `value_source.secret_key_ref`.

## Labels

- Apply common `labels` (`environment`, `project`, `owner`) to every
  labelable resource.

## Structure

- Reusable child modules live in `modules/`.
- Root modules (apply targets) live in `environments/<env>/`.
- Root modules call child modules flatly; child modules do not call other
  child modules.
- Component resources live in child modules.
- Connection resources (firewall rules, IAM bindings, Direct VPC egress
  wiring) live in the root module `connectivity.tf`.

## Backend

- Use the GCS backend. Rely on GCS native locking; do not add an external
  lock resource.
