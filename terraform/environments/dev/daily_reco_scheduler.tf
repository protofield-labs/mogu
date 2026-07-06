# #91: Cloud Scheduler triggers the daily recommendation Cloud Run Job.
resource "google_service_account" "daily_reco_scheduler" {
  count = var.enable_db_connection ? 1 : 0

  project      = var.project_id
  account_id   = "${var.environment}-daily-reco-scheduler"
  display_name = "Cloud Scheduler for daily recommendations (${var.environment})"
}

resource "google_cloud_scheduler_job" "daily_reco" {
  count = var.enable_db_connection ? 1 : 0

  project     = var.project_id
  region      = var.region
  name        = "${var.environment}-daily-reco"
  description = "Generate daily_recommendations for all users (#91)"
  schedule    = "0 4 * * *"
  time_zone   = "Asia/Tokyo"

  attempt_deadline = "600s"

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${module.daily_reco_job[0].name}:run"

    oauth_token {
      service_account_email = google_service_account.daily_reco_scheduler[0].email
    }
  }

  depends_on = [
    google_project_service.services,
    google_cloud_run_v2_job_iam_member.daily_reco_scheduler_invoker,
  ]
}
