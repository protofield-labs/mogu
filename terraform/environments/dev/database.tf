resource "random_password" "db" {
  length  = 24
  special = true
}

module "cloud_sql" {
  source = "../../modules/cloud-sql"

  project_id            = var.project_id
  region                = var.region
  name                  = "${var.environment}-pg"
  database_version      = "POSTGRES_18"
  tier                  = var.db_tier
  edition               = "ENTERPRISE"
  availability_type     = "ZONAL"
  disk_size             = var.db_disk_size
  disk_autoresize_limit = var.db_disk_autoresize_limit
  deletion_protection   = var.sql_deletion_protection
  private_network       = google_compute_network.main.id
  db_name               = var.db_name
  db_user               = var.db_user
  db_password           = random_password.db.result
  # pgvector is enabled via CREATE EXTENSION in ops migrations; Cloud SQL has no
  # cloudsql.enable_pgvector database flag (invalidFlagName on POSTGRES_18).
  enable_pgvector = false
  labels          = local.labels

  # The private IP requires the peering connection to exist first.
  depends_on = [google_service_networking_connection.private_service_access]
}
