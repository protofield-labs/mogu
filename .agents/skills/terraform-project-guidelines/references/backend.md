# Backend and State Storage

## Backend

- Use the GCS backend for all root modules.
- Rely on GCS native object locking. Do not create an external lock
  resource. GCS provides strong read-after-write consistency and native
  state locking, so no separate lock table is needed. This mirrors the
  "S3 native locking" intent of not running a dedicated lock table.
- GCS buckets are encrypted at rest by default (Google-managed keys).

## State Bucket Requirements

- Use one GCS bucket per project to store all state for that project.
- Enable object versioning.
- Enable Uniform bucket-level access.
- Manage the state bucket outside the root modules that consume it
  (bootstrap it manually or in a separate bootstrap configuration).

## State Prefix Layout

Use one state prefix per State boundary and mirror the directory layout:

```text
dev
staging
prod
```

For finer boundaries, extend the prefix (for example
`dev/asia-northeast1/app`).

## Example

Each root module declares its own backend in `backend.tf`:

```hcl
terraform {
  backend "gcs" {
    bucket = "tfstate-mogu"
    prefix = "dev"
  }
}
```

## Rules

- Do not use an external lock table or lock resource.
- Do not share one state prefix across multiple root modules.
- Keep the backend block minimal and pass environment-specific values via
  partial backend config when needed.
