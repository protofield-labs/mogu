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
