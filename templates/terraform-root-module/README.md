# Terraform Root Module Template

Copy this directory when creating a new State boundary root module, such as
`terraform/env/dev/ap-northeast-1/network`.

After copying, rename `*.tf.tmpl` files to `*.tf` and replace placeholder values.

## File Roles

- `backend.tf.tmpl` configures the S3 backend for this State boundary.
- `terraform.tf.tmpl` declares Terraform and provider version constraints.
- `providers.tf.tmpl` configures providers for this root module.
- `locals.tf.tmpl` defines local names and common tags.
- `variables.tf.tmpl` declares root module inputs.
- `main.tf.tmpl` composes flat child modules and local data sources.
- `connectivity.tf.tmpl` owns Security Group Rules.
- `routing.tf.tmpl` owns ALB Listener Rules.
- `outputs.tf.tmpl` publishes stable outputs or cross-state values.
