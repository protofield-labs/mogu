# Terraform Implementation

This directory holds the actual Terraform implementation code.

- Layout and rules: `.agents/skills/terraform-project-guidelines/references/directory-layout.md`
- Reusable child modules live in `modules/` (`cloud-run`, `cloud-sql`, `storage`).
- Root modules (apply targets) live in `environments/<env>/`.
- Infrastructure rules: `terraform/AGENTS.md`.

The dev root module is `environments/dev/`. See the repository root
`README.md` for bootstrap, init, plan, apply, and image build steps.
