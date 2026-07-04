# Directory Layout

## Repository Layout

- `templates/` contains copyable skeletons.
- `terraform/` contains actual Terraform implementation code.
- `scripts/` contains local and CI-compatible utility scripts.
- `.cursor/` contains Cursor hooks.
- `.agents/skills/` contains AI Agent skills.

## Standard Terraform Layout

The expected implementation layout is:

```text
terraform/
+-- modules/
`-- env/
    `-- dev/
        +-- global/
        |   `-- edge/
        `-- ap-northeast-1/
            +-- network/
            +-- app/
            +-- data/
            `-- data-sync/
```

## Rules

- Use directory-based environment separation.
- Do not use Terraform CLI workspaces.
- Keep templates separate from real implementation.
- Use `templates/terraform-root-module/` when creating a new root module.
- Use `templates/terraform-child-module/` when creating a new project child module.
