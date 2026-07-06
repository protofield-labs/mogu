# Slack notification channel and Cloud Monitoring alert policies.
#
# Slack setup (one-time, Console OAuth):
#   1. GCP Console → Monitoring → Alerting → Edit notification channels → Slack
#   2. Authorize the workspace and pick a channel (e.g. #gcp-alerts)
#   3. gcloud monitoring channels list --project=mogu-501309 --filter='type="slack"'
#   4. Set slack_notification_channel_id in terraform.tfvars and apply
#
# Alternatively, set slack_auth_token (from the OAuth flow) to let Terraform
# create the channel. Prefer the channel ID approach to avoid storing tokens.

locals {
  cloud_run_service_name = "${var.environment}-web"
  cloud_sql_database_id  = "${var.project_id}:${var.environment}-pg"
  daily_reco_job_name    = "${var.environment}-daily-reco"

  slack_notification_channel_ids = var.slack_notification_channel_id != "" ? [var.slack_notification_channel_id] : [
    for ch in google_monitoring_notification_channel.slack : ch.id
  ]
}

resource "google_monitoring_notification_channel" "slack" {
  count = var.slack_notification_channel_id == "" && var.slack_auth_token != "" ? 1 : 0

  display_name = "Slack ${var.slack_channel_name}"
  type         = "slack"
  labels = {
    channel_name = var.slack_channel_name
  }
  sensitive_labels {
    auth_token = var.slack_auth_token
  }

  depends_on = [google_project_service.services]
}

resource "google_monitoring_alert_policy" "cloud_run_5xx" {
  count = length(local.slack_notification_channel_ids) > 0 ? 1 : 0

  display_name = "${var.environment}-cloud-run-5xx"
  combiner     = "OR"

  conditions {
    display_name = "Sustained 5xx responses on ${local.cloud_run_service_name}"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"cloud_run_revision\"",
        "resource.labels.service_name=\"${local.cloud_run_service_name}\"",
        "resource.labels.location=\"${var.region}\"",
        "metric.type=\"run.googleapis.com/request_count\"",
        "metric.labels.response_code_class=\"5xx\"",
      ])
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = local.slack_notification_channel_ids

  alert_strategy {
    auto_close = "604800s"
  }

  user_labels = local.labels

  depends_on = [google_project_service.services]
}

resource "google_monitoring_alert_policy" "cloud_run_latency" {
  count = length(local.slack_notification_channel_ids) > 0 ? 1 : 0

  display_name = "${var.environment}-cloud-run-latency"
  combiner     = "OR"

  conditions {
    display_name = "p95 latency > 3s on ${local.cloud_run_service_name}"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"cloud_run_revision\"",
        "resource.labels.service_name=\"${local.cloud_run_service_name}\"",
        "resource.labels.location=\"${var.region}\"",
        "metric.type=\"run.googleapis.com/request_latencies\"",
      ])
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 3000
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_PERCENTILE_95"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  notification_channels = local.slack_notification_channel_ids

  alert_strategy {
    auto_close = "604800s"
  }

  user_labels = local.labels

  depends_on = [google_project_service.services]
}

resource "google_monitoring_alert_policy" "cloud_run_request_spike" {
  count = length(local.slack_notification_channel_ids) > 0 ? 1 : 0

  display_name = "${var.environment}-cloud-run-request-spike"
  combiner     = "OR"

  conditions {
    display_name = "Request rate spike on ${local.cloud_run_service_name} (cost anomaly)"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"cloud_run_revision\"",
        "resource.labels.service_name=\"${local.cloud_run_service_name}\"",
        "resource.labels.location=\"${var.region}\"",
        "metric.type=\"run.googleapis.com/request_count\"",
      ])
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = local.slack_notification_channel_ids

  alert_strategy {
    auto_close = "604800s"
  }

  user_labels = local.labels

  depends_on = [google_project_service.services]
}

resource "google_monitoring_alert_policy" "cloud_sql_cpu" {
  count = length(local.slack_notification_channel_ids) > 0 ? 1 : 0

  display_name = "${var.environment}-cloud-sql-cpu"
  combiner     = "OR"

  conditions {
    display_name = "Cloud SQL CPU > 80% on ${local.cloud_sql_database_id}"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"cloudsql_database\"",
        "resource.labels.database_id=\"${local.cloud_sql_database_id}\"",
        "metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\"",
      ])
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = local.slack_notification_channel_ids

  alert_strategy {
    auto_close = "604800s"
  }

  user_labels = local.labels

  depends_on = [google_project_service.services]
}

resource "google_monitoring_alert_policy" "cloud_sql_disk" {
  count = length(local.slack_notification_channel_ids) > 0 ? 1 : 0

  display_name = "${var.environment}-cloud-sql-disk"
  combiner     = "OR"

  conditions {
    display_name = "Cloud SQL disk > 85% on ${local.cloud_sql_database_id}"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"cloudsql_database\"",
        "resource.labels.database_id=\"${local.cloud_sql_database_id}\"",
        "metric.type=\"cloudsql.googleapis.com/database/disk/utilization\"",
      ])
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = local.slack_notification_channel_ids

  alert_strategy {
    auto_close = "604800s"
  }

  user_labels = local.labels

  depends_on = [google_project_service.services]
}

resource "google_monitoring_alert_policy" "daily_reco_job_failed" {
  count = var.enable_db_connection && length(local.slack_notification_channel_ids) > 0 ? 1 : 0

  display_name = "${var.environment}-daily-reco-job-failed"
  combiner     = "OR"

  conditions {
    display_name = "Daily recommendation job failed on ${local.daily_reco_job_name}"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"cloud_run_job\"",
        "resource.labels.job_name=\"${local.daily_reco_job_name}\"",
        "resource.labels.location=\"${var.region}\"",
        "metric.type=\"run.googleapis.com/job/completed_execution_count\"",
        "metric.labels.result=\"failed\"",
      ])
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = local.slack_notification_channel_ids

  alert_strategy {
    auto_close = "604800s"
  }

  user_labels = local.labels

  depends_on = [google_project_service.services]
}
