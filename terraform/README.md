# Terraform Implementation

This directory holds the actual Terraform implementation code.

- Layout and rules:
  `../.agents/skills/terraform-project-guidelines/references/directory-layout.md`
- Reusable child modules live in `modules/`
  (`cloud-run`, `cloud-run-job`, `cloud-sql`, `storage`).
- Root modules (apply targets) live in `environments/<env>/`.
- Infrastructure rules: `terraform/AGENTS.md`.

The dev root module is `environments/dev/`. See `../docs/SETUP.md` at the
repository root for bootstrap, init, plan, apply, and image build steps.

The dev State includes the web Cloud Run service, Cloud SQL, Storage,
Firebase, Vertex AI Agent Engine, scheduled Cloud Run Jobs, Monitoring /
Budget resources, and the optional incident-agent stack. See the root
module's `*.tf` files and `terraform.tfvars.example` for feature flags and
required values.

## Maintenance workflow

Infrastructure is in maintenance mode. Review changes with:

```bash
./scripts/check.sh terraform
./scripts/plan.sh terraform/environments/dev
```

Run these commands from the repository root. CI runs checks and a reviewed
plan for Terraform pull requests; it never applies infrastructure. Apply is
performed locally or by an approved agent after the plan has been reviewed.
Do not use Terraform CLI workspaces, targeted plans/applies, destroy, state,
force-unlock, or replace operations. See `terraform/AGENTS.md` for the full
safety policy.
