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
  description = "Monthly budget amount in JPY. Email alerts fire at 50/80/100% of actual spend and 100% of forecasted spend."
  type        = number
  default     = 3000
}

# --- Phase 2 feature flag ---

variable "enable_db_connection" {
  description = "Phase 2: wire Cloud Run to Cloud SQL via Direct VPC egress and inject DB secrets. Keep false for Phase 1."
  type        = bool
  default     = false
}
