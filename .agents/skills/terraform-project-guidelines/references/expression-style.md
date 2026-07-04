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
resource "aws_cloudwatch_metric_alarm" "main" {
  count = var.enable_alarm ? 1 : 0

  alarm_name = var.alarm_name
}
```

Avoid:

```hcl
resource "aws_instance" "main" {
  count = length(var.instance_names)

  tags = {
    Name = var.instance_names[count.index]
  }
}
```

Use `for_each` instead:

```hcl
resource "aws_instance" "main" {
  for_each = var.instance_names

  tags = {
    Name = each.key
  }
}
```

## Conditional Expressions

- Conditional expressions are allowed for simple value selection.
- Keep conditional expressions short and readable.
- Avoid nested conditional expressions.
- Move long or repeated conditions into `locals`.
- Prefer explicit booleans such as `var.enable_access_logs` over indirect checks when the condition controls resource creation.

Allowed:

```hcl
count = var.enable_access_logs ? 1 : 0
```

Allowed:

```hcl
locals {
  log_bucket_name = var.enable_access_logs ? var.access_logs_bucket_name : null
}
```

Avoid:

```hcl
instance_type = var.environment == "prod" ? "m7g.large" : var.environment == "staging" ? "m7g.medium" : "t4g.small"
```

Prefer:

```hcl
locals {
  instance_type_by_environment = {
    dev     = "t4g.small"
    staging = "m7g.medium"
    prod    = "m7g.large"
  }
}
```

## Module Interfaces

- Prefer `enable_*` variables for optional module features.
- Keep optional nested objects explicit and typed.
- Do not preserve compatibility for unshipped in-progress module inputs; replace them with the clearer interface.
