variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Cloud Run region."
  type        = string
}

variable "name" {
  description = "Cloud Run service name."
  type        = string
}

variable "image" {
  description = "Container image to deploy."
  type        = string
}

variable "service_account_email" {
  description = "Dedicated runtime service account email."
  type        = string
}

variable "container_port" {
  description = "Container listen port."
  type        = number
  default     = 3000
}

variable "min_instances" {
  description = "Minimum instances. 0 enables scale-to-zero."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum instances."
  type        = number
  default     = 2
}

variable "allow_unauthenticated" {
  description = "Grant allUsers the run.invoker role (public HTTP)."
  type        = bool
  default     = false
}

variable "ingress" {
  description = "Ingress traffic configuration (e.g. INGRESS_TRAFFIC_INTERNAL_ONLY)."
  type        = string
  default     = "INGRESS_TRAFFIC_ALL"

  validation {
    condition = contains([
      "INGRESS_TRAFFIC_ALL",
      "INGRESS_TRAFFIC_INTERNAL_ONLY",
      "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER",
    ], var.ingress)
    error_message = "ingress must be a supported Cloud Run v2 ingress value."
  }
}

variable "request_timeout" {
  description = "Maximum request duration (e.g. 600s)."
  type        = string
  default     = "300s"
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
  description = "Enable Direct VPC egress (Cloud Run to VPC)."
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
  description = "Common labels applied to the service."
  type        = map(string)
  default     = {}
}
