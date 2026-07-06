variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Cloud Run region."
  type        = string
}

variable "name" {
  description = "Cloud Run job name."
  type        = string
}

variable "image" {
  description = "Container image to run."
  type        = string
}

variable "service_account_email" {
  description = "Dedicated runtime service account email."
  type        = string
}

variable "command" {
  description = "Container entrypoint command."
  type        = list(string)
  default     = null
}

variable "args" {
  description = "Container command arguments."
  type        = list(string)
  default     = null
}

variable "env" {
  description = "Plain environment variables."
  type        = map(string)
  default     = {}
}

variable "secret_env" {
  description = "Environment variables sourced from Secret Manager."
  type = map(object({
    secret  = string
    version = string
  }))
  default = {}
}

variable "vpc_access_enabled" {
  description = "Enable Direct VPC egress (Cloud Run Job to VPC)."
  type        = bool
  default     = false
}

variable "vpc_network" {
  description = "VPC network ID for Direct VPC egress."
  type        = string
  default     = null
}

variable "vpc_subnetwork" {
  description = "Subnetwork ID for Direct VPC egress."
  type        = string
  default     = null
}

variable "labels" {
  description = "Common labels applied to the job."
  type        = map(string)
  default     = {}
}

variable "tasks" {
  description = "Number of tasks executed per job run."
  type        = number
  default     = 1
}

variable "task_timeout" {
  description = "Maximum task duration (e.g. 600s)."
  type        = string
  default     = "600s"
}

variable "max_retries" {
  description = "Maximum task retry attempts."
  type        = number
  default     = 0
}
