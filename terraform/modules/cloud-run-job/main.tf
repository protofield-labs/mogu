resource "google_cloud_run_v2_job" "this" {
  name     = var.name
  project  = var.project_id
  location = var.region

  deletion_protection = false
  labels              = var.labels

  template {
    task_count = var.tasks

    template {
      service_account = var.service_account_email
      timeout         = var.task_timeout
      max_retries     = var.max_retries

      dynamic "vpc_access" {
        for_each = var.vpc_access_enabled ? [1] : []

        content {
          egress = "PRIVATE_RANGES_ONLY"

          network_interfaces {
            network    = var.vpc_network
            subnetwork = var.vpc_subnetwork
          }
        }
      }

      containers {
        image   = var.image
        command = var.command
        args    = var.args

        dynamic "env" {
          for_each = var.env

          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = var.secret_env

          content {
            name = env.key

            value_source {
              secret_key_ref {
                secret  = env.value.secret
                version = env.value.version
              }
            }
          }
        }
      }
    }
  }

  # CI / manual deploys update the image; Terraform keeps the initial reference.
  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }
}
