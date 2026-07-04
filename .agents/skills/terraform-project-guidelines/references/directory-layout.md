# Directory Layout

## Repository Layout

- `terraform/` contains actual Terraform implementation code.
- `apps/web/` contains the Next.js (App Router) application.
- `scripts/` contains local and CI-compatible utility scripts.
- `.cursor/` contains Cursor hooks.
- `.agents/skills/` contains AI Agent skills.

## Standard Terraform Layout

The expected implementation layout is:

```text
terraform/
+-- modules/
|   +-- cloud-run/
|   +-- cloud-sql/
|   `-- storage/
`-- environments/
    `-- dev/
        +-- backend.tf
        +-- versions.tf
        +-- variables.tf
        +-- main.tf
        +-- network.tf
        +-- database.tf
        +-- cloudrun.tf
        +-- storage.tf
        +-- secrets.tf
        +-- connectivity.tf
        +-- outputs.tf
        `-- terraform.tfvars.example
```

## Rules

- Use directory-based environment separation.
- Do not use Terraform CLI workspaces.
- Reusable child modules live in `terraform/modules/`.
- Root modules (apply targets) live in `terraform/environments/<env>/`.
- Root modules call child modules flatly.
