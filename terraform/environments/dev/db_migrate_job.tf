# Prisma migrations against dev Cloud SQL (CI deploy + manual runs).
locals {
  db_migrate_job_env = var.enable_db_connection ? {
    DB_HOST       = module.cloud_sql.private_ip_address
    DB_USER       = var.db_user
    DB_NAME       = var.db_name
    RUN_DEMO_SEED = "false"
    NODE_ENV      = "production"
  } : {}
}

module "db_migrate_job" {
  count = var.enable_db_connection ? 1 : 0

  source = "../../modules/cloud-run-job"

  project_id            = var.project_id
  region                = var.region
  name                  = "${var.environment}-db-migrate"
  image                 = local.migrate_image
  service_account_email = google_service_account.web.email
  labels                = local.labels

  env        = local.db_migrate_job_env
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
