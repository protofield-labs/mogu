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

  depends_on = [google_project_service.services]
}
