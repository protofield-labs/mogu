# Cross-State Values

## Rule

Do not use Secret Manager or data sources for values within the same State.

Use module outputs and resource attributes within the same State.

Use Secret Manager, Google provider data sources, or DNS only across State boundaries.

## Network to App / Data

When the network is split into its own State, it publishes values that
App and Data States read with Google provider data sources (for example
`google_compute_network` and `google_compute_subnetwork`) or by resolving
well-known resource names.

## Data to App

When Data is split into its own State, it publishes:

- `instance_connection_name`
- `database_secret_id`

App State reads the secret with `google_secret_manager_secret_version` and
resolves the instance by its connection name.

## Secret Injection

- Store database credentials in Secret Manager.
- Inject them into Cloud Run with `value_source.secret_key_ref`.
- Never expose secret values as plain environment variables or outputs.

## terraform_remote_state

Do not use `terraform_remote_state` by default.

It may be used only when explicitly approved.
