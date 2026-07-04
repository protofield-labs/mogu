# Budget programmatic notifications → Pub/Sub → Cloud Function → Slack.
# Set slack_budget_webhook_url and/or slack_budget_bot_token in terraform.tfvars.

locals {
  budget_slack_enabled = var.slack_budget_webhook_url != "" || var.slack_budget_bot_token != ""
}

data "archive_file" "budget_slack_notifier" {
  count = local.budget_slack_enabled ? 1 : 0

  type        = "zip"
  source_dir  = "${path.module}/../../functions/budget-slack-notifier"
  output_path = "${path.module}/.build/budget-slack-notifier.zip"
}

resource "google_pubsub_topic" "budget_alerts" {
  count = local.budget_slack_enabled ? 1 : 0

  name   = "${var.environment}-billing-budget-alerts"
  labels = local.labels

  depends_on = [google_project_service.services]
}

resource "google_pubsub_topic_iam_member" "billing_budget_publisher" {
  count = local.budget_slack_enabled ? 1 : 0

  topic  = google_pubsub_topic.budget_alerts[0].name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-billing-budgets.iam.gserviceaccount.com"
}

resource "google_service_account" "budget_slack_notifier" {
  count = local.budget_slack_enabled ? 1 : 0

  account_id   = "${var.environment}-budget-slack"
  display_name = "Budget Slack notifier (${var.environment})"
}

resource "google_secret_manager_secret" "slack_budget_webhook" {
  count = var.slack_budget_webhook_url != "" ? 1 : 0

  project   = var.project_id
  secret_id = "${var.environment}-slack-budget-webhook"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "slack_budget_webhook" {
  count = var.slack_budget_webhook_url != "" ? 1 : 0

  secret      = google_secret_manager_secret.slack_budget_webhook[0].id
  secret_data = var.slack_budget_webhook_url
}

resource "google_secret_manager_secret" "slack_budget_bot_token" {
  count = var.slack_budget_bot_token != "" ? 1 : 0

  project   = var.project_id
  secret_id = "${var.environment}-slack-budget-bot-token"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "slack_budget_bot_token" {
  count = var.slack_budget_bot_token != "" ? 1 : 0

  secret      = google_secret_manager_secret.slack_budget_bot_token[0].id
  secret_data = var.slack_budget_bot_token
}

resource "google_secret_manager_secret_iam_member" "budget_slack_notifier_webhook" {
  count = var.slack_budget_webhook_url != "" ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.slack_budget_webhook[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.budget_slack_notifier[0].email}"
}

resource "google_secret_manager_secret_iam_member" "budget_slack_notifier_bot_token" {
  count = var.slack_budget_bot_token != "" ? 1 : 0

  project   = var.project_id
  secret_id = google_secret_manager_secret.slack_budget_bot_token[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.budget_slack_notifier[0].email}"
}

resource "google_storage_bucket_object" "budget_slack_notifier" {
  count = local.budget_slack_enabled ? 1 : 0

  name   = "functions/budget-slack-notifier-${data.archive_file.budget_slack_notifier[0].output_md5}.zip"
  bucket = module.storage.bucket_name
  source = data.archive_file.budget_slack_notifier[0].output_path
}

resource "google_cloudfunctions2_function" "budget_slack_notifier" {
  count = local.budget_slack_enabled ? 1 : 0

  name     = "${var.environment}-budget-slack-notifier"
  location = var.region
  labels   = local.labels

  build_config {
    runtime     = "nodejs22"
    entry_point = "notifySlack"
    source {
      storage_source {
        bucket = module.storage.bucket_name
        object = google_storage_bucket_object.budget_slack_notifier[0].name
      }
    }
  }

  service_config {
    max_instance_count    = 3
    available_memory      = "256Mi"
    timeout_seconds       = 60
    service_account_email = google_service_account.budget_slack_notifier[0].email

    environment_variables = {
      SLACK_CHANNEL = var.slack_budget_channel
    }

    dynamic "secret_environment_variables" {
      for_each = var.slack_budget_webhook_url != "" ? [1] : []

      content {
        key        = "SLACK_WEBHOOK_URL"
        project_id = var.project_id
        secret     = google_secret_manager_secret.slack_budget_webhook[0].secret_id
        version    = "latest"
      }
    }

    dynamic "secret_environment_variables" {
      for_each = var.slack_budget_bot_token != "" ? [1] : []

      content {
        key        = "SLACK_BOT_TOKEN"
        project_id = var.project_id
        secret     = google_secret_manager_secret.slack_budget_bot_token[0].secret_id
        version    = "latest"
      }
    }
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.budget_alerts[0].id
    retry_policy   = "RETRY_POLICY_RETRY"
  }

  depends_on = [
    google_project_service.services,
    google_pubsub_topic_iam_member.billing_budget_publisher,
  ]
}
