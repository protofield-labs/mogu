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

output "github_actions_plan_service_account" {
  description = "Service account email used by GitHub Actions Terraform plan workflow."
  value       = google_service_account.github_actions_plan.email
}

output "budget_slack_pubsub_topic" {
  description = "Pub/Sub topic for billing budget programmatic notifications."
  value       = try(google_pubsub_topic.budget_alerts[0].name, null)
}

output "firebase_web_app_id" {
  description = "Firebase Web App ID (NEXT_PUBLIC_FIREBASE_APP_ID)."
  value       = google_firebase_web_app.web.app_id
}

output "firebase_web_config" {
  description = "Firebase Web SDK config for NEXT_PUBLIC_* build-time env vars."
  value = {
    api_key     = data.google_firebase_web_app_config.web.api_key
    auth_domain = data.google_firebase_web_app_config.web.auth_domain
    project_id  = data.google_firebase_web_app_config.web.project
    app_id      = google_firebase_web_app.web.app_id
  }
}

output "places_api_key_secret_id" {
  description = "Secret Manager secret id for PLACES_API_KEY (empty when enable_external_apis is false)."
  value       = try(google_secret_manager_secret.places_api_key[0].secret_id, null)
}

output "agent_engine_resource_name" {
  description = "Full resource name of the orchestrator Reasoning Engine (#43)."
  value       = try(google_vertex_ai_reasoning_engine.orchestrator[0].id, null)
}

output "maps_grounding_engine_resource_name" {
  description = "Full resource name of the Maps Grounding Reasoning Engine (#43)."
  value       = try(google_vertex_ai_reasoning_engine.maps_grounding[0].id, null)
}

output "daily_reco_job_name" {
  description = "Cloud Run Job name for the nightly daily recommendation batch (#91)."
  value       = try(module.daily_reco_job[0].name, null)
}

output "db_migrate_job_name" {
  description = "Cloud Run Job name for Prisma migrate deploy (CI + manual)."
  value       = try(module.db_migrate_job[0].name, null)
}

output "daily_reco_scheduler_name" {
  description = "Cloud Scheduler job name for the nightly daily recommendation batch (#91)."
  value       = try(google_cloud_scheduler_job.daily_reco[0].name, null)
}
