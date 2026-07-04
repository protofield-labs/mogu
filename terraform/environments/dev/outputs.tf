output "cloud_run_url" {
  description = "Public URL of the Cloud Run web service."
  value       = module.cloud_run.uri
}

output "cloud_run_service_account" {
  description = "Cloud Run runtime service account email."
  value       = google_service_account.web.email
}

output "sql_instance_connection_name" {
  description = "Cloud SQL instance connection name."
  value       = module.cloud_sql.instance_connection_name
}

output "storage_bucket" {
  description = "Application Cloud Storage bucket name."
  value       = module.storage.bucket_name
}

output "artifact_registry_repo" {
  description = "Artifact Registry repository for the web image."
  value       = google_artifact_registry_repository.web.name
}

output "github_actions_service_account" {
  description = "Service account email used by GitHub Actions deploy workflow."
  value       = google_service_account.github_actions.email
}

output "github_actions_workload_identity_provider" {
  description = "Full resource name for google-github-actions/auth workload_identity_provider."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "budget_slack_pubsub_topic" {
  description = "Pub/Sub topic for billing budget programmatic notifications."
  value       = try(google_pubsub_topic.budget_alerts[0].name, null)
}
