# #318: Weekly batch to archive closed persona spots and add fresh candidates.
locals {
  persona_curation_job_env = var.enable_db_connection ? merge(
    {
      DB_HOST  = module.cloud_sql.private_ip_address
      DB_USER  = var.db_user
      DB_NAME  = var.db_name
      NODE_ENV = "production"
    },
    var.enable_external_apis ? {} : {},
  ) : {}

  persona_curation_secret_env = var.enable_db_connection ? merge(
    local.db_secret_env,
    var.enable_external_apis ? local.external_api_secret_env : {},
  ) : {}
}

module "persona_curation_job" {
  count = var.enable_db_connection && var.enable_external_apis ? 1 : 0

  source = "../../modules/cloud-run-job"

  project_id            = var.project_id
  region                = var.region
  name                  = "${var.environment}-persona-curation"
  image                 = local.migrate_image
  service_account_email = google_service_account.web.email
  labels                = local.labels

  command = [
    "sh",
    "-c",
    "export DATABASE_URL=\"postgresql://${var.db_user}:$(node -e 'process.stdout.write(encodeURIComponent(process.env.DB_PASSWORD))')@${module.cloud_sql.private_ip_address}:5432/${var.db_name}?sslmode=require\" && pnpm exec tsx scripts/curate-persona-collections.ts",
  ]

  env        = local.persona_curation_job_env
  secret_env = local.persona_curation_secret_env

  vpc_access_enabled = true
  vpc_network        = google_compute_network.main.id
  vpc_subnetwork     = google_compute_subnetwork.main.id

  task_timeout = "900s"
  max_retries  = 0

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_version.db_password,
    google_secret_manager_secret_iam_member.web_db_password,
  ]
}
