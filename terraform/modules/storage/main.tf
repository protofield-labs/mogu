resource "google_storage_bucket" "this" {
  name          = var.bucket_name
  project       = var.project_id
  location      = var.location
  force_destroy = var.force_destroy

  # Security: enforce uniform access and block all public access.
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  labels = var.labels

  versioning {
    enabled = true
  }
}
