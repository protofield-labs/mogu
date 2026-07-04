# Terraform AI Harness

This repository is a Terraform AI Harness.

It provides rules, scripts, and templates so that AI Agents and humans can
work with Terraform safely.

## Standard Pattern

The standard sample pattern assumes:

- 1 AWS account
- Primary Region: ap-northeast-1
- Public access
- CloudFront + CloudFront WAF
- ALB + ECS Fargate
- Aurora

## Directory Roles

- `templates/` is for copyable skeletons.
- `terraform/` is for actual Terraform implementation code.
- `scripts/` is for local and CI-compatible utility scripts.

Do not treat `templates/` as the default apply target.

## Rules

All rules live in two places:

- `AGENTS.md` is the always-on rule summary.
- `.agents/skills/terraform-project-guidelines/references/` holds the
  detailed rules (layout, module design, state boundaries, backend,
  cross-state values, execution policy).

## Required Tools

- Terraform
- TFLint
- Trivy
- jq

The Cursor shell hook uses `jq` to parse shell execution payloads.
