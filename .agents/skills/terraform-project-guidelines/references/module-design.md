# Module Design

## Principles

- Project child modules must not call other project child modules.
- Root modules compose child modules flatly.
- Child modules own component resources.
- Root modules own connection resources.

## Component and Edge

Component resources:

- ALB
- ECS Service
- Aurora
- CloudFront
- WAF

Edge resources:

- Security Group Rule
- ALB Listener Rule
- Component-to-component connection

In this document, Edge means a graph connection between components.
It does not mean CloudFront Edge Location.

## Security Groups

- Child modules create Security Group resources.
- Child modules output Security Group IDs.
- Root modules create Security Group Rules in `connectivity.tf`.
- Do not use inline `ingress` or `egress`.
- Do not use `aws_security_group_rule`.
- Use `aws_vpc_security_group_ingress_rule`.
- Use `aws_vpc_security_group_egress_rule`.

## Routing

- ALB Listener Rules must be defined in root module `routing.tf`.
- ECS Service modules must output Target Group ARN.
- ALB modules must output Listener ARN.
- Root modules connect Listener ARN and Target Group ARN.
