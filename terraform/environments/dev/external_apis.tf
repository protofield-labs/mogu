locals {
  cloud_run_origin = trimsuffix(module.cloud_run.uri, "/")
  # Browser referrers for the Maps JavaScript API key (#130 / #209).
  # Include the exact Cloud Run origin plus a regional wildcard so a service
  # recreate (new *.run.app hash) does not leave maps tiles blank with
  # RefererNotAllowedMapError until the next targeted apply.
  maps_js_allowed_referrers = [
    "${local.cloud_run_origin}/*",
    local.cloud_run_origin,
    "http://localhost:3000/*",
    "http://127.0.0.1:3000/*",
    "https://*.a.run.app/*",
  ]
}

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

# Maps JavaScript API key for the client-side map view (#130).
# Separate browser key (referrer-restricted); baked into the Next.js bundle
# via the NEXT_PUBLIC_GOOGLE_MAPS_API_KEY GitHub Actions build-arg.
resource "google_apikeys_key" "maps_js" {
  count = var.enable_external_apis ? 1 : 0

  name         = "${var.environment}-maps-js"
  display_name = "Maps JavaScript API browser key (${var.environment})"
  project      = var.project_id

  restrictions {
    api_targets {
      service = "maps-backend.googleapis.com"
    }

    browser_key_restrictions {
      allowed_referrers = local.maps_js_allowed_referrers
    }
  }

  depends_on = [
    google_project_service.services,
    module.cloud_run,
  ]
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
