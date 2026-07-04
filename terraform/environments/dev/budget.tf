# Monthly budget alert scoped to this project. Default billing-account
# emails still fire. Slack requires Pub/Sub + forwarder (see issue #10).
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
    threshold_percent = 0.2
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

  # Programmatic notifications → Pub/Sub → Cloud Function → Slack (#10).
  dynamic "all_updates_rule" {
    for_each = local.budget_slack_enabled ? [1] : []

    content {
      pubsub_topic                   = google_pubsub_topic.budget_alerts[0].id
      disable_default_iam_recipients = false
      schema_version                 = "1.0"
    }
  }

  depends_on = [google_project_service.services]
}
