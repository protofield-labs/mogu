# #355: incident-agent infrastructure (Pub/Sub, Cloud Run x3, Tasks, Scheduler+Job, SAs, secrets).
# Application code lives in services/incident-agent/ (separate issues).

locals {
  incident_agent_enabled = var.enable_db_connection && var.enable_incident_agent

  # Cloud Run validates that the image exists during apply. Require callers to
  # publish an image first instead of defaulting to this repository before its
  # first version exists.
  incident_agent_image = var.incident_agent_image == null ? "" : var.incident_agent_image

  incident_agent_service_names = {
    ingest = "${var.environment}-incident-agent-ingest"
    slack  = "${var.environment}-incident-agent-slack"
    worker = "${var.environment}-incident-agent-worker"
  }

  incident_agent_job_name          = "${var.environment}-incident-agent-outbox-dispatcher"
  incident_agent_slack_queue_name  = "${var.environment}-incident-agent-slack"
  incident_agent_outbox_queue_name = "${var.environment}-incident-agent-outbox"

  # Deterministic Cloud Run URL (#209 pattern). The worker cannot reference its
  # own module output for WORKER_AUDIENCE without a cycle, so both the token
  # minting side (dispatcher) and the verifying side (worker) pin this value.
  incident_agent_worker_audience = "https://${local.incident_agent_service_names.worker}-${data.google_project.current.number}.${var.region}.run.app"

  incident_agent_common_env = local.incident_agent_enabled ? {
    GOOGLE_CLOUD_PROJECT = var.project_id
    NODE_ENV             = "production"
    DB_HOST              = module.cloud_sql.private_ip_address
    DB_NAME              = var.db_name
    MAX_BODY_BYTES       = "262144"
  } : {}

  incident_agent_i6_guard_env = local.incident_agent_enabled ? {
    ALLOWED_SLACK_TEAM_IDS           = var.incident_agent_slack_team_id
    ALLOWED_SLACK_CHANNEL_IDS        = var.incident_agent_slack_channel_id
    ALLOWED_SLACK_USER_IDS           = var.incident_agent_slack_allowed_user_ids
    SLACK_USER_RATE_LIMIT_PER_MINUTE = tostring(var.incident_agent_slack_user_rate_limit_per_minute)
    SLACK_THREAD_RATE_LIMIT_PER_HOUR = tostring(var.incident_agent_slack_thread_rate_limit_per_hour)
  } : {}

  incident_agent_ops_migrate_job_name     = "${var.environment}-incident-agent-ops-migrate"
  incident_agent_slack_retention_job_name = "${var.environment}-incident-agent-slack-retention"

  monitoring_notification_sa = "service-${data.google_project.current.number}@gcp-sa-monitoring-notification.iam.gserviceaccount.com"
}

resource "google_artifact_registry_repository" "incident_agent" {
  count = local.incident_agent_enabled ? 1 : 0

  project       = var.project_id
  location      = var.region
  repository_id = "incident-agent"
  format        = "DOCKER"
  description   = "Container images for incident-agent services"
  labels        = local.labels

  cleanup_policy_dry_run = false
  cleanup_policies {
    id     = "keep-recent-versions"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }
  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s"
    }
  }

  depends_on = [google_project_service.services]
}

resource "google_service_account" "incident_agent_ingest" {
  count = local.incident_agent_enabled ? 1 : 0

  project      = var.project_id
  account_id   = "${var.environment}-incident-agent-ingest"
  display_name = "incident-agent ingest (${var.environment})"
}

resource "google_service_account" "incident_agent_slack" {
  count = local.incident_agent_enabled ? 1 : 0

  project      = var.project_id
  account_id   = "${var.environment}-incident-agent-slack"
  display_name = "incident-agent slack ingress (${var.environment})"
}

resource "google_service_account" "incident_agent_worker" {
  count = local.incident_agent_enabled ? 1 : 0

  project      = var.project_id
  account_id   = "${var.environment}-incident-agent-worker"
  display_name = "incident-agent worker (${var.environment})"
}

resource "google_service_account" "incident_agent_dispatcher" {
  count = local.incident_agent_enabled ? 1 : 0

  project      = var.project_id
  account_id   = "${var.environment}-incident-agent-dispatcher"
  display_name = "incident-agent outbox dispatcher (${var.environment})"
}

resource "google_service_account" "incident_agent_pubsub_push" {
  count = local.incident_agent_enabled ? 1 : 0

  project      = var.project_id
  account_id   = "${var.environment}-incident-agent-pubsub-push"
  display_name = "Pub/Sub OIDC push to incident-agent ingest (${var.environment})"
}

resource "google_service_account" "incident_agent_tasks" {
  count = local.incident_agent_enabled ? 1 : 0

  project      = var.project_id
  account_id   = "${var.environment}-incident-agent-tasks"
  display_name = "Cloud Tasks OIDC to incident-agent worker (${var.environment})"
}

resource "google_service_account" "incident_agent_scheduler" {
  count = local.incident_agent_enabled ? 1 : 0

  project      = var.project_id
  account_id   = "${var.environment}-incident-agent-scheduler"
  display_name = "Cloud Scheduler for incident-agent outbox dispatcher (${var.environment})"
}

resource "random_password" "incident_agent_ops_ingest" {
  count = local.incident_agent_enabled ? 1 : 0

  length  = 24
  special = true
}

resource "random_password" "incident_agent_ops_slack_ingress" {
  count = local.incident_agent_enabled ? 1 : 0

  length  = 24
  special = true
}

resource "random_password" "incident_agent_ops_worker" {
  count = local.incident_agent_enabled ? 1 : 0

  length  = 24
  special = true
}

resource "random_password" "incident_agent_ops_dispatcher" {
  count = local.incident_agent_enabled ? 1 : 0

  length  = 24
  special = true
}

resource "random_password" "incident_agent_ops_operator" {
  count = local.incident_agent_enabled ? 1 : 0

  length  = 24
  special = true
}

resource "random_password" "incident_agent_ops_reviewer" {
  count = local.incident_agent_enabled ? 1 : 0

  length  = 24
  special = true
}

resource "google_sql_user" "incident_agent_ops_ingest" {
  count = local.incident_agent_enabled ? 1 : 0

  name     = "ops_ingest"
  project  = var.project_id
  instance = module.cloud_sql.instance_name
  password = random_password.incident_agent_ops_ingest[0].result
}

resource "google_sql_user" "incident_agent_ops_slack_ingress" {
  count = local.incident_agent_enabled ? 1 : 0

  name     = "ops_slack_ingress"
  project  = var.project_id
  instance = module.cloud_sql.instance_name
  password = random_password.incident_agent_ops_slack_ingress[0].result
}

resource "google_sql_user" "incident_agent_ops_worker" {
  count = local.incident_agent_enabled ? 1 : 0

  name     = "ops_worker"
  project  = var.project_id
  instance = module.cloud_sql.instance_name
  password = random_password.incident_agent_ops_worker[0].result
}

resource "google_sql_user" "incident_agent_ops_dispatcher" {
  count = local.incident_agent_enabled ? 1 : 0

  name     = "ops_dispatcher"
  project  = var.project_id
  instance = module.cloud_sql.instance_name
  password = random_password.incident_agent_ops_dispatcher[0].result
}

resource "google_sql_user" "incident_agent_ops_operator" {
  count = local.incident_agent_enabled ? 1 : 0

  name     = "ops_operator"
  project  = var.project_id
  instance = module.cloud_sql.instance_name
  password = random_password.incident_agent_ops_operator[0].result
}

resource "google_sql_user" "incident_agent_ops_reviewer" {
  count = local.incident_agent_enabled ? 1 : 0

  name     = "ops_reviewer"
  project  = var.project_id
  instance = module.cloud_sql.instance_name
  password = random_password.incident_agent_ops_reviewer[0].result
}

resource "google_secret_manager_secret" "incident_agent_slack_signing" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = "${var.environment}-incident-agent-slack-signing-secret"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "incident_agent_slack_signing" {
  count = local.incident_agent_enabled && var.incident_agent_slack_signing_secret != "" ? 1 : 0

  secret      = google_secret_manager_secret.incident_agent_slack_signing[0].id
  secret_data = var.incident_agent_slack_signing_secret
}

resource "google_secret_manager_secret" "incident_agent_slack_bot_token" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = "${var.environment}-incident-agent-slack-bot-token"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "incident_agent_slack_bot_token" {
  count = local.incident_agent_enabled && var.incident_agent_slack_bot_token != "" ? 1 : 0

  secret      = google_secret_manager_secret.incident_agent_slack_bot_token[0].id
  secret_data = var.incident_agent_slack_bot_token
}

resource "google_secret_manager_secret" "incident_agent_github_token" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = "${var.environment}-incident-agent-github-token"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "incident_agent_github_token" {
  count = local.incident_agent_enabled && var.incident_agent_github_token != "" ? 1 : 0

  secret      = google_secret_manager_secret.incident_agent_github_token[0].id
  secret_data = var.incident_agent_github_token
}

resource "google_secret_manager_secret" "incident_agent_ops_ingest_password" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = "${var.environment}-incident-agent-ops-ingest-password"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "incident_agent_ops_ingest_password" {
  count = local.incident_agent_enabled ? 1 : 0

  secret      = google_secret_manager_secret.incident_agent_ops_ingest_password[0].id
  secret_data = random_password.incident_agent_ops_ingest[0].result
}

resource "google_secret_manager_secret" "incident_agent_ops_slack_ingress_password" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = "${var.environment}-incident-agent-ops-slack-ingress-password"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "incident_agent_ops_slack_ingress_password" {
  count = local.incident_agent_enabled ? 1 : 0

  secret      = google_secret_manager_secret.incident_agent_ops_slack_ingress_password[0].id
  secret_data = random_password.incident_agent_ops_slack_ingress[0].result
}

resource "google_secret_manager_secret" "incident_agent_ops_worker_password" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = "${var.environment}-incident-agent-ops-worker-password"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "incident_agent_ops_worker_password" {
  count = local.incident_agent_enabled ? 1 : 0

  secret      = google_secret_manager_secret.incident_agent_ops_worker_password[0].id
  secret_data = random_password.incident_agent_ops_worker[0].result
}

resource "google_secret_manager_secret" "incident_agent_ops_dispatcher_password" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = "${var.environment}-incident-agent-ops-dispatcher-password"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "incident_agent_ops_dispatcher_password" {
  count = local.incident_agent_enabled ? 1 : 0

  secret      = google_secret_manager_secret.incident_agent_ops_dispatcher_password[0].id
  secret_data = random_password.incident_agent_ops_dispatcher[0].result
}

resource "google_secret_manager_secret" "incident_agent_ops_operator_password" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = "${var.environment}-incident-agent-ops-operator-password"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "incident_agent_ops_operator_password" {
  count = local.incident_agent_enabled ? 1 : 0

  secret      = google_secret_manager_secret.incident_agent_ops_operator_password[0].id
  secret_data = random_password.incident_agent_ops_operator[0].result
}

resource "google_secret_manager_secret" "incident_agent_ops_reviewer_password" {
  count = local.incident_agent_enabled ? 1 : 0

  project   = var.project_id
  secret_id = "${var.environment}-incident-agent-ops-reviewer-password"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "incident_agent_ops_reviewer_password" {
  count = local.incident_agent_enabled ? 1 : 0

  secret      = google_secret_manager_secret.incident_agent_ops_reviewer_password[0].id
  secret_data = random_password.incident_agent_ops_reviewer[0].result
}

resource "google_pubsub_topic" "incident_alerts" {
  count = local.incident_agent_enabled ? 1 : 0

  name   = "incident-alerts"
  labels = local.labels

  depends_on = [google_project_service.services]
}

resource "google_pubsub_subscription" "incident_alerts_ingest" {
  count = local.incident_agent_enabled ? 1 : 0

  name  = "${var.environment}-incident-alerts-ingest-push"
  topic = google_pubsub_topic.incident_alerts[0].name

  ack_deadline_seconds = 600

  push_config {
    push_endpoint = "${module.incident_agent_ingest[0].uri}/pubsub/alerts"

    oidc_token {
      service_account_email = google_service_account.incident_agent_pubsub_push[0].email
      audience              = module.incident_agent_ingest[0].uri
    }
  }

  depends_on = [
    module.incident_agent_ingest,
    google_cloud_run_v2_service_iam_member.incident_agent_pubsub_push_invoker,
  ]
}

resource "google_cloud_tasks_queue" "incident_agent_slack" {
  count = local.incident_agent_enabled ? 1 : 0

  name     = local.incident_agent_slack_queue_name
  location = var.region

  rate_limits {
    max_concurrent_dispatches = 10
    max_dispatches_per_second = 5
  }

  retry_config {
    max_attempts       = 3
    max_retry_duration = "600s"
  }

  depends_on = [google_project_service.services]
}

resource "google_cloud_tasks_queue" "incident_agent_outbox" {
  count = local.incident_agent_enabled ? 1 : 0

  name     = local.incident_agent_outbox_queue_name
  location = var.region

  rate_limits {
    max_concurrent_dispatches = 10
    max_dispatches_per_second = 5
  }

  retry_config {
    max_attempts       = 10
    max_retry_duration = "3600s"
    min_backoff        = "670s"
    max_backoff        = "900s"
  }

  depends_on = [google_project_service.services]
}

module "incident_agent_ingest" {
  count = local.incident_agent_enabled ? 1 : 0

  source = "../../modules/cloud-run"

  project_id            = var.project_id
  region                = var.region
  name                  = local.incident_agent_service_names.ingest
  image                 = local.incident_agent_image
  service_account_email = google_service_account.incident_agent_ingest[0].email
  container_port        = 8080
  min_instances         = 0
  max_instances         = var.incident_agent_max_instances
  allow_unauthenticated = false
  ingress               = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  request_timeout       = "600s"
  labels                = local.labels

  command = ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

  env = merge(local.incident_agent_common_env, {
    SERVICE_MODE = "ingest"
    DB_USER      = google_sql_user.incident_agent_ops_ingest[0].name
  })

  secret_env = {
    DB_PASSWORD = {
      secret  = google_secret_manager_secret.incident_agent_ops_ingest_password[0].secret_id
      version = "latest"
    }
  }

  vpc_access_enabled = true
  vpc_network        = google_compute_network.main.id
  vpc_subnetwork     = google_compute_subnetwork.main.id

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_version.incident_agent_ops_ingest_password,
    google_secret_manager_secret_iam_member.incident_agent_ingest_ops_password,
  ]
}

module "incident_agent_worker" {
  count = local.incident_agent_enabled ? 1 : 0

  source = "../../modules/cloud-run"

  project_id            = var.project_id
  region                = var.region
  name                  = local.incident_agent_service_names.worker
  image                 = local.incident_agent_image
  service_account_email = google_service_account.incident_agent_worker[0].email
  container_port        = 8080
  min_instances         = 0
  max_instances         = var.incident_agent_max_instances
  allow_unauthenticated = false
  ingress               = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  request_timeout       = "600s"
  labels                = local.labels

  command = ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

  env = merge(local.incident_agent_common_env, local.incident_agent_i6_guard_env, {
    SERVICE_MODE         = "worker"
    DB_USER              = google_sql_user.incident_agent_ops_worker[0].name
    CLOUD_TASKS_OIDC_SA  = google_service_account.incident_agent_tasks[0].email
    CLOUD_TASKS_LOCATION = var.region
    GITHUB_REPOSITORY    = var.github_repository
    OUTBOX_LEASE_SECONDS = "660"
    SLACK_CHANNEL_ID     = var.incident_agent_slack_channel_id
    SLACK_TEAM_ID        = var.incident_agent_slack_team_id
    WORKER_AUDIENCE      = local.incident_agent_worker_audience
  })

  secret_env = merge(
    {
      DB_PASSWORD = {
        secret  = google_secret_manager_secret.incident_agent_ops_worker_password[0].secret_id
        version = "latest"
      }
    },
    var.incident_agent_slack_bot_token != "" ? {
      SLACK_BOT_TOKEN = {
        secret  = google_secret_manager_secret.incident_agent_slack_bot_token[0].secret_id
        version = "latest"
      }
    } : {},
    var.incident_agent_github_token != "" ? {
      GITHUB_TOKEN = {
        secret  = google_secret_manager_secret.incident_agent_github_token[0].secret_id
        version = "latest"
      }
    } : {},
  )

  vpc_access_enabled = true
  vpc_network        = google_compute_network.main.id
  vpc_subnetwork     = google_compute_subnetwork.main.id

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_version.incident_agent_ops_worker_password,
    google_secret_manager_secret_iam_member.incident_agent_worker_ops_password,
    google_secret_manager_secret_iam_member.incident_agent_worker_slack_bot_token,
    google_secret_manager_secret_iam_member.incident_agent_worker_github_token,
  ]
}

module "incident_agent_slack" {
  count = local.incident_agent_enabled ? 1 : 0

  source = "../../modules/cloud-run"

  project_id            = var.project_id
  region                = var.region
  name                  = local.incident_agent_service_names.slack
  image                 = local.incident_agent_image
  service_account_email = google_service_account.incident_agent_slack[0].email
  container_port        = 8080
  min_instances         = 0
  max_instances         = var.incident_agent_max_instances
  allow_unauthenticated = false
  ingress               = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  request_timeout       = "60s"
  labels                = local.labels

  command = ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

  env = merge(local.incident_agent_common_env, local.incident_agent_i6_guard_env, {
    SERVICE_MODE              = "slack"
    DB_USER                   = google_sql_user.incident_agent_ops_slack_ingress[0].name
    CLOUD_TASKS_QUEUE         = local.incident_agent_slack_queue_name
    CLOUD_TASKS_LOCATION      = var.region
    CLOUD_TASKS_TARGET_URL    = module.incident_agent_worker[0].uri
    CLOUD_TASKS_OIDC_SA       = google_service_account.incident_agent_tasks[0].email
    CLOUD_TASKS_OIDC_AUDIENCE = local.incident_agent_worker_audience
  })

  secret_env = merge(
    {
      DB_PASSWORD = {
        secret  = google_secret_manager_secret.incident_agent_ops_slack_ingress_password[0].secret_id
        version = "latest"
      }
    },
    var.incident_agent_slack_signing_secret != "" ? {
      SLACK_SIGNING_SECRET = {
        secret  = google_secret_manager_secret.incident_agent_slack_signing[0].secret_id
        version = "latest"
      }
    } : {},
  )

  vpc_access_enabled = true
  vpc_network        = google_compute_network.main.id
  vpc_subnetwork     = google_compute_subnetwork.main.id

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_version.incident_agent_ops_slack_ingress_password,
    google_secret_manager_secret_iam_member.incident_agent_slack_ops_password,
    google_secret_manager_secret_iam_member.incident_agent_slack_signing,
    module.incident_agent_worker,
  ]
}

module "incident_agent_outbox_dispatcher" {
  count = local.incident_agent_enabled ? 1 : 0

  source = "../../modules/cloud-run-job"

  project_id            = var.project_id
  region                = var.region
  name                  = local.incident_agent_job_name
  image                 = local.incident_agent_image
  service_account_email = google_service_account.incident_agent_dispatcher[0].email
  labels                = local.labels

  command = ["python", "-m", "jobs.outbox_dispatcher"]

  env = merge(local.incident_agent_common_env, {
    DB_USER                   = google_sql_user.incident_agent_ops_dispatcher[0].name
    CLOUD_TASKS_QUEUE         = local.incident_agent_outbox_queue_name
    CLOUD_TASKS_LOCATION      = var.region
    CLOUD_TASKS_TARGET_URL    = module.incident_agent_worker[0].uri
    CLOUD_TASKS_OIDC_SA       = google_service_account.incident_agent_tasks[0].email
    CLOUD_TASKS_OIDC_AUDIENCE = local.incident_agent_worker_audience
  })

  secret_env = {
    DB_PASSWORD = {
      secret  = google_secret_manager_secret.incident_agent_ops_dispatcher_password[0].secret_id
      version = "latest"
    }
  }

  vpc_access_enabled = true
  vpc_network        = google_compute_network.main.id
  vpc_subnetwork     = google_compute_subnetwork.main.id

  task_timeout = "300s"
  max_retries  = 0

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_version.incident_agent_ops_dispatcher_password,
    google_secret_manager_secret_iam_member.incident_agent_dispatcher_ops_password,
    module.incident_agent_worker,
  ]
}

resource "google_cloud_scheduler_job" "incident_agent_outbox_dispatcher" {
  count = local.incident_agent_enabled ? 1 : 0

  project     = var.project_id
  region      = var.region
  name        = "${var.environment}-incident-agent-outbox-dispatcher"
  description = "Scan ops.outbox and enqueue Cloud Tasks every minute (#355)"
  schedule    = "* * * * *"
  time_zone   = "Asia/Tokyo"

  attempt_deadline = "300s"

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${module.incident_agent_outbox_dispatcher[0].name}:run"

    oauth_token {
      service_account_email = google_service_account.incident_agent_scheduler[0].email
    }
  }

  depends_on = [
    google_project_service.services,
    google_cloud_run_v2_job_iam_member.incident_agent_scheduler_dispatcher_invoker,
  ]
}

module "incident_agent_ops_migrate_job" {
  count = local.incident_agent_enabled ? 1 : 0

  source = "../../modules/cloud-run-job"

  project_id            = var.project_id
  region                = var.region
  name                  = local.incident_agent_ops_migrate_job_name
  image                 = local.incident_agent_image
  service_account_email = google_service_account.web.email
  labels                = local.labels

  command = ["python", "-m", "jobs.ops_migrate"]

  env = merge(local.incident_agent_common_env, {
    DB_USER    = var.db_user
    DB_SSLMODE = "require"
  })

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
    module.cloud_sql,
  ]
}

module "incident_agent_slack_retention_job" {
  count = local.incident_agent_enabled ? 1 : 0

  source = "../../modules/cloud-run-job"

  project_id            = var.project_id
  region                = var.region
  name                  = local.incident_agent_slack_retention_job_name
  image                 = local.incident_agent_image
  service_account_email = google_service_account.incident_agent_worker[0].email
  labels                = local.labels

  command = ["python", "-m", "jobs.slack_retention"]

  env = merge(local.incident_agent_common_env, {
    DB_USER                     = google_sql_user.incident_agent_ops_worker[0].name
    SLACK_EVENTS_RETENTION_DAYS = "7"
    SESSION_RETENTION_DAYS      = "30"
  })

  secret_env = {
    DB_PASSWORD = {
      secret  = google_secret_manager_secret.incident_agent_ops_worker_password[0].secret_id
      version = "latest"
    }
  }

  vpc_access_enabled = true
  vpc_network        = google_compute_network.main.id
  vpc_subnetwork     = google_compute_subnetwork.main.id

  task_timeout = "600s"
  max_retries  = 0

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_version.incident_agent_ops_worker_password,
    google_secret_manager_secret_iam_member.incident_agent_worker_ops_password,
  ]
}

resource "google_cloud_scheduler_job" "incident_agent_slack_retention" {
  count = local.incident_agent_enabled ? 1 : 0

  project     = var.project_id
  region      = var.region
  name        = "${var.environment}-incident-agent-slack-retention"
  description = "Purge completed slack_events and expired Vertex sessions daily (#369)"
  schedule    = "0 3 * * *"
  time_zone   = "Asia/Tokyo"

  attempt_deadline = "600s"

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${module.incident_agent_slack_retention_job[0].name}:run"

    oauth_token {
      service_account_email = google_service_account.incident_agent_scheduler[0].email
    }
  }

  depends_on = [
    google_project_service.services,
    google_cloud_run_v2_job_iam_member.incident_agent_scheduler_retention_invoker,
  ]
}
