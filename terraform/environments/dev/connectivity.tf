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

# #47: Places API key in Secret Manager → Cloud Run env PLACES_API_KEY.
resource "google_secret_manager_secret_iam_member" "web_places_api_key" {
  count = var.enable_external_apis ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.places_api_key[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web.email}"
}

# #47: Vertex AI / Agent Engine calls use Application Default Credentials.
resource "google_project_iam_member" "web_vertex_ai_user" {
  count = var.enable_external_apis ? 1 : 0

  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.web.email}"
}

# #80: GCS signed upload URLs (getSignedUrl → signBlob) and media proxy reads.
# Scoped to the uploads/ prefix so the web SA cannot touch other objects
# (e.g. the budget notifier source zip) in the shared app bucket.
resource "google_storage_bucket_iam_member" "web_app_object_creator" {
  bucket = module.storage.bucket_name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.web.email}"

  condition {
    title      = "uploads-prefix-only"
    expression = "resource.name.startsWith(\"projects/_/buckets/${module.storage.bucket_name}/objects/uploads/\")"
  }
}

resource "google_storage_bucket_iam_member" "web_app_object_viewer" {
  bucket = module.storage.bucket_name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.web.email}"

  condition {
    title      = "uploads-prefix-only"
    expression = "resource.name.startsWith(\"projects/_/buckets/${module.storage.bucket_name}/objects/uploads/\")"
  }
}

resource "google_service_account_iam_member" "web_sign_blob" {
  service_account_id = google_service_account.web.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.web.email}"
}

# #91: Cloud Scheduler OAuth → daily recommendation Cloud Run Job.
resource "google_cloud_run_v2_job_iam_member" "daily_reco_scheduler_invoker" {
  count = var.enable_db_connection ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = module.daily_reco_job[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.daily_reco_scheduler[0].email}"
}

# #318: Cloud Scheduler OAuth → persona curation Cloud Run Job.
resource "google_cloud_run_v2_job_iam_member" "persona_curation_scheduler_invoker" {
  count = var.enable_db_connection && var.enable_external_apis ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = module.persona_curation_job[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.persona_curation_scheduler[0].email}"
}

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

# #355: incident-agent IAM / secret / queue connections.

resource "google_pubsub_topic_iam_binding" "incident_alerts_publishers" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  topic   = google_pubsub_topic.incident_alerts[0].name
  role    = "roles/pubsub.publisher"
  members = [
    "serviceAccount:${local.monitoring_notification_sa}",
  ]
}

resource "google_service_account_iam_member" "incident_agent_pubsub_push_token_creator" {
  count = local.incident_agent_enabled ? 1 : 0

  service_account_id = google_service_account.incident_agent_pubsub_push[0].name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_cloud_run_v2_service_iam_member" "incident_agent_pubsub_push_invoker" {
  count = local.incident_agent_enabled ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = module.incident_agent_ingest[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.incident_agent_pubsub_push[0].email}"
}

resource "google_cloud_run_v2_service_iam_member" "incident_agent_tasks_worker_invoker" {
  count = local.incident_agent_enabled ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = module.incident_agent_worker[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.incident_agent_tasks[0].email}"
}

resource "google_cloud_run_v2_job_iam_member" "incident_agent_scheduler_dispatcher_invoker" {
  count = local.incident_agent_enabled ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = module.incident_agent_outbox_dispatcher[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.incident_agent_scheduler[0].email}"
}

resource "google_cloud_tasks_queue_iam_member" "incident_agent_slack_enqueuer" {
  count = local.incident_agent_enabled ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_tasks_queue.incident_agent_slack[0].name
  role     = "roles/cloudtasks.enqueuer"
  member   = "serviceAccount:${google_service_account.incident_agent_slack[0].email}"
}

resource "google_cloud_tasks_queue_iam_member" "incident_agent_dispatcher_outbox_enqueuer" {
  count = local.incident_agent_enabled ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_tasks_queue.incident_agent_outbox[0].name
  role     = "roles/cloudtasks.enqueuer"
  member   = "serviceAccount:${google_service_account.incident_agent_dispatcher[0].email}"
}

resource "google_service_account_iam_member" "incident_agent_slack_tasks_act_as" {
  count = local.incident_agent_enabled ? 1 : 0

  service_account_id = google_service_account.incident_agent_tasks[0].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.incident_agent_slack[0].email}"
}

resource "google_service_account_iam_member" "incident_agent_dispatcher_tasks_act_as" {
  count = local.incident_agent_enabled ? 1 : 0

  service_account_id = google_service_account.incident_agent_tasks[0].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.incident_agent_dispatcher[0].email}"
}

resource "google_service_account_iam_member" "incident_agent_cloud_tasks_agent_act_as" {
  count = local.incident_agent_enabled ? 1 : 0

  service_account_id = google_service_account.incident_agent_tasks[0].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-cloudtasks.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "incident_agent_ingest_monitoring_viewer" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:${google_service_account.incident_agent_ingest[0].email}"
}

resource "google_project_iam_member" "incident_agent_ingest_logging_viewer" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/logging.viewer"
  member  = "serviceAccount:${google_service_account.incident_agent_ingest[0].email}"
}

resource "google_project_iam_member" "incident_agent_ingest_cloudtrace_agent" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.incident_agent_ingest[0].email}"
}

resource "google_project_iam_member" "incident_agent_ingest_vertex_ai_user" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.incident_agent_ingest[0].email}"
}

resource "google_project_iam_member" "incident_agent_ingest_cloudsql_client" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.incident_agent_ingest[0].email}"
}

resource "google_secret_manager_secret_iam_member" "incident_agent_ingest_ops_password" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.incident_agent_ops_ingest_password[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.incident_agent_ingest[0].email}"
}

resource "google_project_iam_member" "incident_agent_slack_cloudsql_client" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.incident_agent_slack[0].email}"
}

resource "google_secret_manager_secret_iam_member" "incident_agent_slack_ops_password" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.incident_agent_ops_slack_ingress_password[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.incident_agent_slack[0].email}"
}

resource "google_secret_manager_secret_iam_member" "incident_agent_slack_signing" {
  count = local.incident_agent_enabled && var.incident_agent_slack_signing_secret != "" ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.incident_agent_slack_signing[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.incident_agent_slack[0].email}"
}

resource "google_project_iam_member" "incident_agent_worker_monitoring_viewer" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:${google_service_account.incident_agent_worker[0].email}"
}

resource "google_project_iam_member" "incident_agent_worker_logging_viewer" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/logging.viewer"
  member  = "serviceAccount:${google_service_account.incident_agent_worker[0].email}"
}

resource "google_project_iam_member" "incident_agent_worker_cloudtrace_agent" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.incident_agent_worker[0].email}"
}

resource "google_project_iam_member" "incident_agent_worker_vertex_ai_user" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.incident_agent_worker[0].email}"
}

resource "google_project_iam_member" "incident_agent_worker_cloudsql_client" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.incident_agent_worker[0].email}"
}

resource "google_secret_manager_secret_iam_member" "incident_agent_worker_ops_password" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.incident_agent_ops_worker_password[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.incident_agent_worker[0].email}"
}

resource "google_secret_manager_secret_iam_member" "incident_agent_worker_slack_bot_token" {
  count = local.incident_agent_enabled && var.incident_agent_slack_bot_token != "" ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.incident_agent_slack_bot_token[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.incident_agent_worker[0].email}"
}

resource "google_secret_manager_secret_iam_member" "incident_agent_worker_github_token" {
  count = local.incident_agent_enabled && var.incident_agent_github_token != "" ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.incident_agent_github_token[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.incident_agent_worker[0].email}"
}

resource "google_project_iam_member" "incident_agent_dispatcher_cloudsql_client" {
  count = local.incident_agent_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.incident_agent_dispatcher[0].email}"
}

resource "google_secret_manager_secret_iam_member" "incident_agent_dispatcher_ops_password" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.incident_agent_ops_dispatcher_password[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.incident_agent_dispatcher[0].email}"
}

resource "google_service_account_iam_member" "github_actions_act_as_incident_agent_ingest" {
  count = local.incident_agent_enabled ? 1 : 0

  service_account_id = google_service_account.incident_agent_ingest[0].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_service_account_iam_member" "github_actions_act_as_incident_agent_slack" {
  count = local.incident_agent_enabled ? 1 : 0

  service_account_id = google_service_account.incident_agent_slack[0].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_service_account_iam_member" "github_actions_act_as_incident_agent_worker" {
  count = local.incident_agent_enabled ? 1 : 0

  service_account_id = google_service_account.incident_agent_worker[0].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_service_account_iam_member" "github_actions_act_as_incident_agent_dispatcher" {
  count = local.incident_agent_enabled ? 1 : 0

  service_account_id = google_service_account.incident_agent_dispatcher[0].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions.email}"
}
