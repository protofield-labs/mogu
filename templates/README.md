# Terraform Templates

This directory contains copyable Terraform skeletons.
Templates are not apply targets; copy them into `terraform/` before use.

- `terraform-root-module/` is for State boundary root modules such as
  `terraform/env/dev/ap-northeast-1/network`.
- `terraform-child-module/` is for flat project child modules such as
  `terraform/modules/vpc`.
