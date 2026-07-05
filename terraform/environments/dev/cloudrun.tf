# Dedicated runtime service account (do not use the default Compute SA).
resource "google_service_account" "web" {
  project      = var.project_id
  account_id   = "${var.environment}-web-run"
  display_name = "Cloud Run web service account (${var.environment})"
}

locals {
  base_env = {
    NODE_ENV = "production"
  }

  # Phase 2: DB connection info is injected only when enabled.
  db_env = var.enable_db_connection ? {
    INSTANCE_CONNECTION_NAME = module.cloud_sql.instance_connection_name
    DB_NAME                  = var.db_name
    DB_USER                  = var.db_user
    DATABASE_HOST            = module.cloud_sql.private_ip_address
    GOOGLE_CLOUD_PROJECT     = var.project_id
    } : {
    GOOGLE_CLOUD_PROJECT = var.project_id
  }
  app_env = merge(local.base_env, local.db_env)
  db_secret_env = var.enable_db_connection ? {
    DB_PASSWORD = {
      secret  = google_secret_manager_secret.db_password.secret_id
      version = "latest"
    }
  } : {}
  external_api_secret_env = var.enable_external_apis ? {
    PLACES_API_KEY = {
      secret  = google_secret_manager_secret.places_api_key[0].secret_id
      version = "latest"
    }
  } : {}
  secret_env = merge(local.db_secret_env, local.external_api_secret_env)
}

module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id            = var.project_id
  region                = var.region
  name                  = "${var.environment}-web"
  image                 = var.app_image
  service_account_email = google_service_account.web.email
  container_port        = 3000
  min_instances         = 0
  max_instances         = var.max_instances
  allow_unauthenticated = true
  labels                = local.labels

  env        = local.app_env
  secret_env = local.secret_env

  # Phase 2: Direct VPC egress toggled by the feature flag.
  vpc_access_enabled = var.enable_db_connection
  vpc_network        = google_compute_network.main.id
  vpc_subnetwork     = google_compute_subnetwork.main.id

  depends_on = [google_project_service.services]
}
