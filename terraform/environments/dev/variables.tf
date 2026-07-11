variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Primary region for all resources."
  type        = string
  default     = "asia-northeast1"
}

variable "environment" {
  description = "Environment name, used in resource names and labels."
  type        = string
  default     = "dev"
}

variable "owner" {
  description = "Owner label applied to all resources."
  type        = string
}

variable "terraform_firebase_impersonators" {
  description = "IAM members allowed to impersonate the Terraform Firebase SA (e.g. user:you@example.com)."
  type        = set(string)
  default     = []
}

variable "google_oauth_client_id" {
  description = "OAuth 2.0 Web client ID for Google sign-in (optional; leave empty to enable in Console)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_oauth_client_secret" {
  description = "OAuth 2.0 client secret for Google sign-in (optional; leave empty to enable in Console)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "subnet_cidr" {
  description = "Primary subnet CIDR range."
  type        = string
  default     = "10.10.0.0/24"
}

# --- Cloud Run ---

variable "app_image" {
  description = "Container image for the web service. Defaults to a public placeholder for the first apply."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "migrate_image" {
  description = "Container image for Cloud Run Jobs (migrate, daily-reco). Defaults to Artifact Registry migrate:latest."
  type        = string
  default     = null
}

variable "max_instances" {
  description = "Maximum Cloud Run instances."
  type        = number
  default     = 2
}

# --- Cloud SQL ---

variable "db_name" {
  description = "Application database name."
  type        = string
  default     = "app"
}

variable "db_user" {
  description = "Application database user."
  type        = string
  default     = "app_user"
}

variable "db_tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-f1-micro"
}

variable "db_disk_size" {
  description = "Cloud SQL initial disk size (GB)."
  type        = number
  default     = 10
}

variable "db_disk_autoresize_limit" {
  description = "Cloud SQL disk autoresize upper bound (GB)."
  type        = number
  default     = 50
}

variable "sql_deletion_protection" {
  description = "Protect Cloud SQL from deletion. WARNING: dev default is false so the instance can be recreated; do not use false in prod."
  type        = bool
  default     = false
}

# --- Billing budget ---

variable "billing_account_id" {
  description = "Billing account ID (e.g. 000000-000000-000000) that the budget alert is attached to."
  type        = string
}

variable "monthly_budget_jpy" {
  description = "Monthly budget amount in JPY. Email alerts fire at 20/50/80/100% of actual spend and 100% of forecasted spend."
  type        = number
  default     = 3000
}

# --- Phase 2 feature flag ---

variable "github_repository" {
  description = "GitHub repository allowed to authenticate via Workload Identity Federation (owner/name)."
  type        = string
  default     = "protofield-labs/mogu"
}

variable "terraform_state_bucket" {
  description = "GCS bucket holding Terraform state for this root module (bootstrap bucket)."
  type        = string
  default     = "tfstate-mogu"
}

variable "enable_db_connection" {
  description = "Phase 2: wire Cloud Run to Cloud SQL via Direct VPC egress and inject DB secrets. Keep false for Phase 1."
  type        = bool
  default     = false
}

variable "enable_external_apis" {
  description = "Enable Places API key (Secret Manager) and Vertex AI IAM for Cloud Run (#47). Requires Maps Platform billing on the project."
  type        = bool
  default     = false
}

variable "enable_agent_engine" {
  description = "Deploy Vertex AI Reasoning Engines (orchestrator + maps) and inject AGENT_ENGINE_* env (#43). Requires enable_external_apis."
  type        = bool
  default     = false
}

# --- Monitoring / Slack notifications ---

variable "slack_channel_name" {
  description = "Slack channel name for Monitoring notifications (e.g. #gcp-alerts). Used when creating the channel via Terraform."
  type        = string
  default     = "#gcp-alerts"
}

variable "slack_notification_channel_id" {
  description = "Existing Monitoring Slack notification channel ID (preferred). Create via Console OAuth, then: gcloud monitoring channels list --filter='type=\"slack\"'"
  type        = string
  default     = ""
}

variable "slack_auth_token" {
  description = "Slack OAuth token to create a Monitoring notification channel via Terraform. Prefer slack_notification_channel_id instead."
  type        = string
  sensitive   = true
  default     = ""
}

variable "slack_budget_webhook_url" {
  description = "Slack Incoming Webhook URL for budget alerts (#mogu-lab). Enables Pub/Sub + Cloud Function forwarding."
  type        = string
  sensitive   = true
  default     = ""
}

variable "slack_budget_bot_token" {
  description = "Slack Bot User OAuth token for budget alerts (chat.postMessage). Alternative to slack_budget_webhook_url."
  type        = string
  sensitive   = true
  default     = ""
}

variable "slack_budget_channel" {
  description = "Slack channel for budget alerts when using slack_budget_bot_token."
  type        = string
  default     = "#mogu-lab"
}

variable "enable_incident_agent" {
  description = "Deploy incident-agent infrastructure (Pub/Sub, Cloud Run x3, Tasks, LB). Requires enable_db_connection."
  type        = bool
  default     = false
}

variable "incident_agent_image" {
  description = "Existing container image for incident-agent services. Required when enable_incident_agent is true."
  type        = string
  default     = null

  validation {
    condition     = !var.enable_incident_agent || try(length(trimspace(var.incident_agent_image)) > 0, false)
    error_message = "incident_agent_image must reference an existing image when enable_incident_agent is true."
  }
}

variable "incident_agent_max_instances" {
  description = "Maximum Cloud Run instances per incident-agent service."
  type        = number
  default     = 2
}

variable "incident_agent_slack_domain" {
  description = "HTTPS domain for incident-agent-slack external LB (managed cert). Requires incident_agent_slack_signing_secret when set."
  type        = string
  default     = ""

  validation {
    condition     = var.incident_agent_slack_domain == "" || var.incident_agent_slack_signing_secret != ""
    error_message = "incident_agent_slack_signing_secret is required when incident_agent_slack_domain is set (§7-8)."
  }
}

variable "incident_agent_slack_rate_limit_per_ip" {
  description = "Cloud Armor per-IP requests per minute before deny (§7-12)."
  type        = number
  default     = 100
}

variable "incident_agent_slack_rate_limit_global_rps" {
  description = "Cloud Armor global requests per second throttle (§7-12)."
  type        = number
  default     = 50
}

variable "incident_agent_slack_signing_secret" {
  description = "Slack Signing Secret for incident-agent (separate from budget_slack). Stored in Secret Manager."
  type        = string
  sensitive   = true
  default     = ""
}

variable "incident_agent_slack_bot_token" {
  description = "Slack Bot User OAuth token for incident-agent (chat:write, history scopes). Separate from budget_slack."
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = !var.enable_incident_agent || length(trimspace(var.incident_agent_slack_bot_token)) > 0
    error_message = "incident_agent_slack_bot_token is required when enable_incident_agent is true."
  }
}

variable "incident_agent_slack_channel_id" {
  description = "Slack channel ID for incident-agent primary notifications."
  type        = string
  default     = ""

  validation {
    condition     = !var.enable_incident_agent || can(regex("^[CG][A-Z0-9]+$", var.incident_agent_slack_channel_id))
    error_message = "incident_agent_slack_channel_id must be a Slack C/G-prefixed channel ID when incident-agent is enabled."
  }
}

variable "incident_agent_slack_team_id" {
  description = "Slack workspace/team ID for incident-agent primary notifications."
  type        = string
  default     = ""

  validation {
    condition     = !var.enable_incident_agent || can(regex("^T[A-Z0-9]+$", var.incident_agent_slack_team_id))
    error_message = "incident_agent_slack_team_id must be a Slack T-prefixed team ID when incident-agent is enabled."
  }
}

variable "incident_agent_github_token" {
  description = "GitHub fine-grained token for incident-agent Issue operations."
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = !var.enable_incident_agent || length(trimspace(var.incident_agent_github_token)) > 0
    error_message = "incident_agent_github_token is required when enable_incident_agent is true."
  }
}
