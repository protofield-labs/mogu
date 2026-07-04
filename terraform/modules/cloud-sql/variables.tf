variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Instance region."
  type        = string
}

variable "name" {
  description = "Cloud SQL instance name."
  type        = string
}

variable "database_version" {
  description = "Cloud SQL database version enum (for example POSTGRES_18)."
  type        = string
  default     = "POSTGRES_18"
}

variable "tier" {
  description = "Machine tier. db-f1-micro is the cheapest for dev."
  type        = string
  default     = "db-f1-micro"
}

variable "edition" {
  description = "Cloud SQL edition."
  type        = string
  default     = "ENTERPRISE"
}

variable "availability_type" {
  description = "ZONAL (no HA) or REGIONAL (HA)."
  type        = string
  default     = "ZONAL"
}

variable "disk_size" {
  description = "Initial disk size in GB."
  type        = number
  default     = 10
}

variable "disk_autoresize_limit" {
  description = "Upper bound for disk autoresize in GB (0 = no limit)."
  type        = number
  default     = 50
}

variable "deletion_protection" {
  description = "Protect the instance from deletion. Keep true outside dev."
  type        = bool
  default     = true
}

variable "private_network" {
  description = "Self link / ID of the VPC used for private IP."
  type        = string
}

variable "db_name" {
  description = "Application database name."
  type        = string
}

variable "db_user" {
  description = "Application database user."
  type        = string
}

variable "db_password" {
  description = "Application database user password."
  type        = string
  sensitive   = true
}

variable "labels" {
  description = "Common labels applied to the instance."
  type        = map(string)
  default     = {}
}
