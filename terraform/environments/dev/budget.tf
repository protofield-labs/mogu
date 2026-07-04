# Monthly budget alert scoped to this project. Default billing-account
# emails still fire; add Slack via slack_notification_channel_id (monitoring.tf).
data "google_project" "current" {
  project_id = var.project_id
}

resource "google_billing_budget" "monthly" {
  provider = google.billing

  billing_account = var.billing_account_id
  display_name    = "${var.environment}-monthly-budget"

  budget_filter {
    projects = ["projects/${data.google_project.current.number}"]
  }

  amount {
    specified_amount {
      currency_code = "JPY"
      units         = tostring(var.monthly_budget_jpy)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.8
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  # Early warning: fires when the forecast projects the month will exceed 100%.
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  # Slack notifications (same channel as Cloud Monitoring alerts in monitoring.tf).
  dynamic "all_updates_rule" {
    for_each = length(local.slack_notification_channel_ids) > 0 ? [1] : []

    content {
      monitoring_notification_channels = local.slack_notification_channel_ids
      disable_default_iam_recipients   = false
    }
  }

  depends_on = [google_project_service.services]
}
