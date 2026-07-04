# Component-to-component connections live here.
#
# Phase 2: grant the Cloud Run service account read access to the DB
# password secret. Gated by enable_db_connection so Phase 1 keeps the app
# and database disconnected.
resource "google_secret_manager_secret_iam_member" "web_db_password" {
  count = var.enable_db_connection ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.db_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web.email}"
}

# Phase 2: allow the Cloud Run service account to connect to Cloud SQL
# via the Cloud SQL connectors (INSTANCE_CONNECTION_NAME).
resource "google_project_iam_member" "web_cloudsql_client" {
  count = var.enable_db_connection ? 1 : 0

  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.web.email}"
}

# Firebase Admin SDK on Cloud Run uses ADC for credentials only.
# verifyIdToken() validates against public JWKS and needs no IAM role, so the
# web SA gets none here. Add roles/firebaseauth.viewer (checkRevoked) or
# roles/firebaseauth.admin (user management) only when those APIs are used.

# GitHub Actions: push images and deploy new revisions to Cloud Run.
resource "google_project_iam_member" "github_actions_artifact_registry_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_service_account_iam_member" "github_actions_act_as_web" {
  service_account_id = google_service_account.web.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions.email}"
}

# GitHub Actions plan job: strictly read-only. Anyone who can push a branch
# can impersonate this SA via workflow edits, so it must not be able to
# mutate state or infrastructure. CI plans with -lock=false so no state
# writes are needed.
resource "google_project_iam_member" "github_actions_plan_viewer" {
  project = var.project_id
  role    = "roles/viewer"
  member  = "serviceAccount:${google_service_account.github_actions_plan.email}"
}

# securityReviewer provides *.getIamPolicy (bucket/SA IAM reads during refresh).
resource "google_project_iam_member" "github_actions_plan_security_reviewer" {
  project = var.project_id
  role    = "roles/iam.securityReviewer"
  member  = "serviceAccount:${google_service_account.github_actions_plan.email}"
}

# Read tfstate objects (roles/viewer does not include object data access).
resource "google_storage_bucket_iam_member" "github_actions_plan_state" {
  bucket = var.terraform_state_bucket
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.github_actions_plan.email}"
}
