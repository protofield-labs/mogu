# #91: Nightly batch to populate daily_recommendations for all users.
locals {
  migrate_image = coalesce(
    var.migrate_image,
    "${var.region}-docker.pkg.dev/${var.project_id}/web/migrate:latest",
  )

  daily_reco_job_env = var.enable_db_connection ? {
    DB_HOST  = module.cloud_sql.private_ip_address
    DB_USER  = var.db_user
    DB_NAME  = var.db_name
    NODE_ENV = "production"
  } : {}
}

module "daily_reco_job" {
  count = var.enable_db_connection ? 1 : 0

  source = "../../modules/cloud-run-job"

  project_id            = var.project_id
  region                = var.region
  name                  = "${var.environment}-daily-reco"
  image                 = local.migrate_image
  service_account_email = google_service_account.web.email
  labels                = local.labels

  command = [
    "sh",
    "-c",
    "export DATABASE_URL=postgresql://${var.db_user}:$${DB_PASSWORD}@${module.cloud_sql.private_ip_address}:5432/${var.db_name}?sslmode=require && pnpm exec tsx scripts/generate-daily-recommendations.ts",
  ]

  env        = local.daily_reco_job_env
  secret_env = local.db_secret_env

  vpc_access_enabled = true
  vpc_network        = google_compute_network.main.id
  vpc_subnetwork     = google_compute_subnetwork.main.id

  task_timeout = "600s"
  max_retries  = 0

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_version.db_password,
    google_secret_manager_secret_iam_member.web_db_password,
  ]
}
