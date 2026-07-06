resource "google_storage_bucket" "this" {
  name          = var.bucket_name
  project       = var.project_id
  location      = var.location
  force_destroy = var.force_destroy

  # Security: enforce uniform access and block all public access.
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  labels = var.labels

  dynamic "cors" {
    for_each = length(var.cors_origins) > 0 ? [1] : []

    content {
      origin          = var.cors_origins
      method          = ["GET", "HEAD", "PUT", "OPTIONS"]
      response_header = ["Content-Type", "x-goog-generation", "x-goog-metageneration"]
      max_age_seconds = 3600
    }
  }

  versioning {
    enabled = true
  }
}
