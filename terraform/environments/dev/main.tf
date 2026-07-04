locals {
  # Common labels applied to every labelable resource.
  labels = {
    environment = var.environment
    project     = var.project_id
    owner       = var.owner
  }
}

# Enable the APIs required by this root module explicitly.
resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com",
    "secretmanager.googleapis.com",
    "compute.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "billingbudgets.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "monitoring.googleapis.com",
    "pubsub.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "eventarc.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  # Keep APIs enabled if the config is torn down.
  disable_on_destroy = false
}

# Artifact Registry repository that Cloud Run pulls the app image from.
resource "google_artifact_registry_repository" "web" {
  project       = var.project_id
  location      = var.region
  repository_id = "web"
  format        = "DOCKER"
  description   = "Container images for the web app"
  labels        = local.labels

  # Cost control: keep the 10 most recent images; delete stale untagged layers.
  cleanup_policy_dry_run = false
  cleanup_policies {
    id     = "keep-recent-versions"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }
  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s"
    }
  }

  depends_on = [google_project_service.services]
}
