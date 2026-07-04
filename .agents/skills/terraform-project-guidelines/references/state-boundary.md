# State Boundary

State is separated by lifecycle, change frequency, blast radius, and review boundary.

Each State boundary maps to one GCS backend state prefix. See `backend.md` for backend and state storage rules.

## MVP State

For the current MVP, a single State boundary is used:

- `dev` (`terraform/environments/dev`)

This State manages the network, database, application, storage, and
secrets for the dev environment together. Splitting into finer States is
premature at this scale.

## Future States

When scale requires it, split into separate States such as:

- `network`

  Manages VPC, subnets, Private Service Access
  (`google_compute_global_address` + `google_service_networking_connection`),
  and firewall rules.

  Publishes:

  - `network_id`
  - `subnet_ids`

- `app`

  Manages Cloud Run v2 services, service accounts, and IAM invoker bindings.

- `data`

  Manages Cloud SQL for PostgreSQL, Private IP configuration, Secret
  Manager secrets, backups, and deletion protection.

  Publishes:

  - `instance_connection_name`
  - `database_secret_id`
  - `private_ip_address`, if needed
