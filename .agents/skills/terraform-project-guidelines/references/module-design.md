# Module Design

## Principles

- Project child modules must not call other project child modules.
- Root modules compose child modules flatly.
- Child modules own component resources.
- Root modules own connection resources.

## Component and Edge

Component resources:

- Cloud Run v2 Service
- Cloud SQL for PostgreSQL Instance
- Cloud Storage Bucket
- Secret Manager Secret

Edge resources:

- Firewall Rule
- IAM binding (for example Cloud Run invoker, Secret accessor)
- Direct VPC egress wiring between Cloud Run and the VPC
- Component-to-component connection

In this document, Edge means a graph connection between components.

## Networking and Firewall

- Child modules create the network component resources they own.
- Child modules output IDs (for example subnet ID, service account email).
- Root modules create Firewall Rules in `connectivity.tf`.
- Keep firewall rules explicit and scoped; avoid overly broad ranges.

## Service Wiring

- Cloud Run modules must output the service name and service account email.
- Cloud SQL modules must output the instance connection name and private IP.
- Root modules wire Cloud Run to Cloud SQL (Direct VPC egress) and inject
  connection details in `connectivity.tf`.
