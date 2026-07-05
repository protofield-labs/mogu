# Firebase / Identity Platform (#14). Uses google-beta.firebase (SA impersonation).
resource "google_firebase_project" "default" {
  provider = google-beta.firebase
  project  = var.project_id

  depends_on = [
    google_project_service.services,
    google_project_iam_member.terraform_firebase_admin,
    google_project_iam_member.terraform_firebase_service_usage_consumer,
    google_project_iam_member.terraform_firebase_service_usage_admin,
    google_service_account_iam_member.terraform_firebase_impersonation,
  ]
}

resource "google_firebase_web_app" "web" {
  provider     = google-beta.firebase
  project      = var.project_id
  display_name = "Mogu Web (${var.environment})"

  depends_on = [google_firebase_project.default]
}

data "google_firebase_web_app_config" "web" {
  provider   = google-beta.firebase
  web_app_id = google_firebase_web_app.web.app_id
}

resource "google_identity_platform_config" "default" {
  provider = google-beta.firebase
  project  = var.project_id

  # Cloud Run exposes two URLs for the same service (legacy hash + deterministic).
  # Both must be authorized or signInWithPopup fails with auth/unauthorized-domain.
  authorized_domains = [
    "localhost",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
    replace(module.cloud_run.uri, "https://", ""),
    "${var.environment}-web-${data.google_project.current.number}.${var.region}.run.app",
  ]

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled           = true
      password_required = true
    }
  }

  depends_on = [google_firebase_project.default]
}

# Google sign-in: enable manually in Firebase Console after apply, or set
# google_oauth_client_id / google_oauth_client_secret in terraform.tfvars.
resource "google_identity_platform_default_supported_idp_config" "google" {
  count = var.google_oauth_client_id != "" && var.google_oauth_client_secret != "" ? 1 : 0

  provider      = google-beta.firebase
  project       = var.project_id
  enabled       = true
  idp_id        = "google.com"
  client_id     = var.google_oauth_client_id
  client_secret = var.google_oauth_client_secret

  depends_on = [google_identity_platform_config.default]
}
