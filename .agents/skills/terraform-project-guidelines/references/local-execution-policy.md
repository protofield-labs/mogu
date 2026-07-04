# Local Execution Policy

## Allowed Commands

- `terraform init`
- `terraform fmt`
- `terraform validate`
- `terraform plan`
- `terraform apply`

## Denied Commands

- `terraform destroy`
- `terraform state *`
- `terraform force-unlock`
- `terraform workspace *`
- `terraform plan -destroy`
- `terraform apply -destroy`
- `terraform plan -replace=...`
- `terraform apply -replace=...`
- `terraform plan -target=...`
- `terraform apply -target=...`
- `terraform plan --target=...`
- `terraform apply --target=...`

## Workspace

Do not use Terraform CLI workspaces.

Use directory-based environment separation.
