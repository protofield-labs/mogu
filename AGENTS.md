# Terraform AI Harness Agent Guide (Google Cloud)

This file is the entry point for AI Agents working in this repository.

This is the single always-on rule summary that applies to the whole
repository. Layer-specific rules live closer to the code and win over
this file when they are more specific:

- `terraform/AGENTS.md` for infrastructure (maintenance mode).
- `apps/web/AGENTS.md` for the Next.js app (development mode).

Detailed Terraform rules live in
`.agents/skills/terraform-project-guidelines/references/`. When rules
conflict, the reference documents win.

## Repository Layout

- `terraform/` holds actual Terraform implementation code (apply target).
- `apps/web/` holds the Next.js (App Router) application.
- `scripts/` holds local and CI-compatible utility scripts.
- `.cursor/` holds Cursor hooks.
- `.agents/skills/` holds AI Agent skills.

## Terraform Structure

- Do not use Terraform CLI workspaces.
- Use directory-based environment separation.
- Do not call project child modules from other project child modules.
- Root modules must call child modules flatly.
- Component resources must be placed in child modules.
- Component-to-component connections must be placed in root modules.
- Connection resources (firewall rules, IAM bindings, Direct VPC egress
  wiring) must be placed in the root module `connectivity.tf`.

## Expression Style

- Prefer `for_each` for multiple resources.
- Use `count` only for optional 0-or-1 resources.
- Avoid `count.index` for resource identity.
- Keep conditional expressions simple and move complex conditions into `locals`.

## Values and State Boundaries

- Use module outputs for values within the same State.
- Use Secret Manager or Google provider data sources for values across
  State boundaries.
- Do not use `terraform_remote_state` by default.

## Backend and State Storage

- Use the GCS backend for all root modules.
- Rely on GCS native object locking; do not add an external lock resource
  (this mirrors the S3 native-locking intent of not running a separate
  lock table).
- Use one state prefix per State boundary.

## Naming and Labels

- Apply common `labels` (`environment`, `project`, `owner`) to every
  labelable resource.
- Store secrets in Secret Manager; never hardcode sensitive values.

## Command Policy

- Do not run `terraform destroy`.
- Do not run `terraform state` commands.
- Do not run `terraform force-unlock`.
- Do not run `terraform workspace` commands.
- Do not use `-destroy`, `-replace`, `-target`, or `--target` with `terraform plan` or `terraform apply`.
- Run `scripts/check.sh` before reporting completion.
- Use `scripts/plan.sh` when a Terraform plan is needed.
