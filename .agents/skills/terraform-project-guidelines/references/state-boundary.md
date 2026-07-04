# State Boundary

State is separated by lifecycle, change frequency, blast radius, and review boundary.

Each State boundary maps to one S3 backend state key. See `backend.md` for backend and state storage rules.

## Standard States

- `global/edge`
- `ap-northeast-1/network`
- `ap-northeast-1/app`
- `ap-northeast-1/data`
- `ap-northeast-1/data-sync`

## global/edge

Manages CloudFront, CloudFront WAF, ACM for CloudFront, and edge policies.

## network

Manages VPC, public subnets, private subnets, route tables, NAT Gateway, and VPC endpoints.

Publishes:

- `vpc_id`
- `public_subnet_ids`
- `private_subnet_ids`

## app

Manages ALB, ECS Fargate, Listener Rules, Security Group Rules, Auto Scaling, and CloudWatch Logs.

## data

Manages Aurora, DB Subnet Group, Aurora Security Group, Secrets Manager Secret, backups, and deletion protection.

Publishes:

- `aurora_security_group_id`
- `database_secret_arn`
- `database_endpoint`, if needed

## data-sync

Manages DMS, CDC S3, EventBridge, SQS FIFO, Lambda, DynamoDB Ledger, DLQ, and alarms.
