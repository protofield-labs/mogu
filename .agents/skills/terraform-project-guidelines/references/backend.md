# Backend and State Storage

## Backend

- Use the S3 backend for all root modules.
- Do not use DynamoDB for state locking.
- Use S3 native locking with `use_lockfile = true` (Terraform 1.10+).
- Enable server-side encryption with `encrypt = true`.

## State Bucket Requirements

- Use one S3 bucket per AWS account to store all state for that account.
- Enable bucket versioning.
- Enable server-side encryption (SSE-KMS or SSE-S3).
- Enable Block Public Access on the bucket.
- Manage the state bucket outside the root modules that consume it.

## State Key Layout

Use one state key per State boundary and mirror the directory layout:

```text
dev/global/edge/terraform.tfstate
dev/ap-northeast-1/network/terraform.tfstate
dev/ap-northeast-1/app/terraform.tfstate
dev/ap-northeast-1/data/terraform.tfstate
dev/ap-northeast-1/data-sync/terraform.tfstate
```

## Example

Each root module declares its own backend in `backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket       = "example-tfstate-123456789012"
    key          = "dev/ap-northeast-1/app/terraform.tfstate"
    region       = "ap-northeast-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

## Rules

- Do not use DynamoDB lock tables.
- Do not share one state key across multiple root modules.
- Keep the backend block minimal and pass environment-specific values via partial backend config when needed.
