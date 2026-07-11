# #318: Cloud Scheduler triggers the persona curation Cloud Run Job weekly.
resource "google_service_account" "persona_curation_scheduler" {
  count = var.enable_db_connection && var.enable_external_apis ? 1 : 0

  project      = var.project_id
  account_id   = "${var.environment}-persona-curation-scheduler"
  display_name = "Cloud Scheduler for persona curation (${var.environment})"
}

resource "google_cloud_scheduler_job" "persona_curation" {
  count = var.enable_db_connection && var.enable_external_apis ? 1 : 0

  project     = var.project_id
  region      = var.region
  name        = "${var.environment}-persona-curation"
  description = "Archive closed persona spots and add fresh candidates (#318)"
  schedule    = "0 5 * * 1"
  time_zone   = "Asia/Tokyo"

  attempt_deadline = "900s"

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${module.persona_curation_job[0].name}:run"

    oauth_token {
      service_account_email = google_service_account.persona_curation_scheduler[0].email
    }
  }

  depends_on = [
    google_project_service.services,
    google_cloud_run_v2_job_iam_member.persona_curation_scheduler_invoker,
  ]
}
