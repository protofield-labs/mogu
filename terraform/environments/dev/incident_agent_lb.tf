# #355: External HTTPS LB + serverless NEG + Cloud Armor for incident-agent-slack (§7-12).
locals {
  incident_agent_slack_lb_enabled = local.incident_agent_enabled && var.incident_agent_slack_domain != "" && var.incident_agent_slack_signing_secret != ""
}

resource "google_compute_global_address" "incident_agent_slack" {
  count = local.incident_agent_slack_lb_enabled ? 1 : 0

  name    = "${var.environment}-incident-agent-slack-ip"
  project = var.project_id
}

resource "google_compute_region_network_endpoint_group" "incident_agent_slack" {
  count = local.incident_agent_slack_lb_enabled ? 1 : 0

  name                  = "${var.environment}-incident-agent-slack-neg"
  project               = var.project_id
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = module.incident_agent_slack[0].name
  }
}

resource "google_compute_security_policy" "incident_agent_slack" {
  count = local.incident_agent_slack_lb_enabled ? 1 : 0

  name    = "${var.environment}-incident-agent-slack-armor"
  project = var.project_id

  rule {
    action   = "rate_based_ban"
    priority = 1000
    preview  = false

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = var.incident_agent_slack_rate_limit_per_ip
        interval_sec = 60
      }

      ban_duration_sec = 300
    }
  }

  rule {
    action   = "throttle"
    priority = 2000
    preview  = false

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "ALL"

      rate_limit_threshold {
        count        = var.incident_agent_slack_rate_limit_global_rps
        interval_sec = 1
      }
    }
  }

  rule {
    action   = "allow"
    priority = 2147483647
    preview  = false

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}

resource "google_compute_backend_service" "incident_agent_slack" {
  count = local.incident_agent_slack_lb_enabled ? 1 : 0

  name                  = "${var.environment}-incident-agent-slack-backend"
  project               = var.project_id
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  security_policy       = google_compute_security_policy.incident_agent_slack[0].id

  backend {
    group = google_compute_region_network_endpoint_group.incident_agent_slack[0].id
  }

  log_config {
    enable = true
  }
}

resource "google_compute_url_map" "incident_agent_slack" {
  count = local.incident_agent_slack_lb_enabled ? 1 : 0

  name            = "${var.environment}-incident-agent-slack-url-map"
  project         = var.project_id
  default_service = google_compute_backend_service.incident_agent_slack[0].id
}

resource "google_compute_managed_ssl_certificate" "incident_agent_slack" {
  count = local.incident_agent_slack_lb_enabled ? 1 : 0

  name    = "${var.environment}-incident-agent-slack-cert"
  project = var.project_id

  managed {
    domains = [var.incident_agent_slack_domain]
  }
}

resource "google_compute_target_https_proxy" "incident_agent_slack" {
  count = local.incident_agent_slack_lb_enabled ? 1 : 0

  name             = "${var.environment}-incident-agent-slack-https-proxy"
  project          = var.project_id
  url_map          = google_compute_url_map.incident_agent_slack[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.incident_agent_slack[0].id]
}

resource "google_compute_global_forwarding_rule" "incident_agent_slack_https" {
  count = local.incident_agent_slack_lb_enabled ? 1 : 0

  name                  = "${var.environment}-incident-agent-slack-https"
  project               = var.project_id
  ip_address            = google_compute_global_address.incident_agent_slack[0].id
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range            = "443"
  target                = google_compute_target_https_proxy.incident_agent_slack[0].id
}

resource "google_cloud_run_v2_service_iam_member" "incident_agent_slack_lb_invoker" {
  count = local.incident_agent_slack_lb_enabled ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = module.incident_agent_slack[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
