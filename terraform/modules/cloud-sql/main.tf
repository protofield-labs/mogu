resource "google_sql_database_instance" "this" {
  name             = var.name
  project          = var.project_id
  region           = var.region
  database_version = var.database_version

  # Cost/safety: variable so dev can be recreated; keep true in prod.
  deletion_protection = var.deletion_protection

  settings {
    tier              = var.tier
    edition           = var.edition
    availability_type = var.availability_type

    disk_size             = var.disk_size
    disk_autoresize       = true
    disk_autoresize_limit = var.disk_autoresize_limit

    # Security: private IP only, no public IPv4, enforce TLS.
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.private_network
      ssl_mode        = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }

    dynamic "database_flags" {
      for_each = var.enable_pgvector ? [1] : []

      content {
        name  = "cloudsql.enable_pgvector"
        value = "on"
      }
    }

    user_labels = var.labels
  }
}

resource "google_sql_database" "this" {
  name     = var.db_name
  project  = var.project_id
  instance = google_sql_database_instance.this.name
}

resource "google_sql_user" "this" {
  name     = var.db_user
  project  = var.project_id
  instance = google_sql_database_instance.this.name
  password = var.db_password
}
