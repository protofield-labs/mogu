# Places API key + Secret Manager (#47). Gated by enable_external_apis so Phase 1
# applies stay unchanged until dev is ready for Maps / Vertex spend.
resource "google_apikeys_key" "places" {
  count = var.enable_external_apis ? 1 : 0

  name         = "${var.environment}-places"
  display_name = "Places API (${var.environment})"
  project      = var.project_id

  restrictions {
    api_targets {
      service = "places.googleapis.com"
    }
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret" "places_api_key" {
  count = var.enable_external_apis ? 1 : 0

  project   = var.project_id
  secret_id = "${var.environment}-places-api-key"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "places_api_key" {
  count = var.enable_external_apis ? 1 : 0

  secret      = google_secret_manager_secret.places_api_key[0].id
  secret_data = google_apikeys_key.places[0].key_string
}
