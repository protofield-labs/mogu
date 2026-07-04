variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "bucket_name" {
  description = "Globally unique bucket name."
  type        = string
}

variable "location" {
  description = "Bucket location (region)."
  type        = string
}

variable "force_destroy" {
  description = "Allow deleting a non-empty bucket. Keep false outside dev."
  type        = bool
  default     = false
}

variable "labels" {
  description = "Common labels applied to the bucket."
  type        = map(string)
  default     = {}
}
