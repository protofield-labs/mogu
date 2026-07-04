# Cross-State Values

## Rule

Do not use Parameter Store for values within the same State.

Use module outputs and resource attributes within the same State.

Use SSM Parameter Store, Secrets Manager, DNS, or provider data sources only across State boundaries.

## Network to App / Data

Network State publishes:

- `/project/dev/network/vpc-id`
- `/project/dev/network/public-subnet-ids`
- `/project/dev/network/private-subnet-ids`

App and Data States read these values with `aws_ssm_parameter`.

## Data to App

Data State publishes:

- `/project/dev/data/aurora-security-group-id`
- `/project/dev/data/database-secret-arn`

App State reads these values with `aws_ssm_parameter`.

## Subnet Rule

Only publish:

- `public_subnet_ids`
- `private_subnet_ids`

Do not publish:

- `private_app_subnet_ids`
- `private_ingress_subnet_ids`
- `private_lambda_subnet_ids`
- `database_subnet_ids`, unless DB-dedicated subnets actually exist

## terraform_remote_state

Do not use `terraform_remote_state` by default.

It may be used only when explicitly approved.
