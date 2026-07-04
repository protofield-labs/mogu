# Expression Style

## Dynamic Resource Creation

- Prefer `for_each` for multiple resources.
- Use stable, meaningful keys for `for_each`.
- Avoid resource identity based on list positions or generated indexes.
- Do not use `count` for multiple named resources.
- Use `count` only for optional 0-or-1 resources.

## count

Allowed:

```hcl
resource "google_monitoring_alert_policy" "main" {
  count = var.enable_alarm ? 1 : 0

  display_name = var.alarm_name
}
```

Avoid:

```hcl
resource "google_compute_instance" "main" {
  count = length(var.instance_names)

  name = var.instance_names[count.index]
}
```

Use `for_each` instead:

```hcl
resource "google_compute_instance" "main" {
  for_each = toset(var.instance_names)

  name = each.key
}
```

## Conditional Expressions

- Conditional expressions are allowed for simple value selection.
- Keep conditional expressions short and readable.
- Avoid nested conditional expressions.
- Move long or repeated conditions into `locals`.
- Prefer explicit booleans such as `var.enable_db_connection` over indirect checks when the condition controls resource creation.

Allowed:

```hcl
count = var.enable_db_connection ? 1 : 0
```

Allowed:

```hcl
locals {
  db_secret_id = var.enable_db_connection ? google_secret_manager_secret.db.id : null
}
```

Avoid:

```hcl
machine_type = var.environment == "prod" ? "db-custom-4-16384" : var.environment == "staging" ? "db-custom-2-8192" : "db-f1-micro"
```

Prefer:

```hcl
locals {
  tier_by_environment = {
    dev     = "db-f1-micro"
    staging = "db-custom-2-8192"
    prod    = "db-custom-4-16384"
  }
}
```

## Module Interfaces

- Prefer `enable_*` variables for optional module features.
- Keep optional nested objects explicit and typed.
- Do not preserve compatibility for unshipped in-progress module inputs; replace them with the clearer interface.
