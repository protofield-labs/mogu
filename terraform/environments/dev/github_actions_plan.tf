# GitHub Actions Terraform plan identity (read-only; separate from deploy SA).
resource "google_service_account" "github_actions_plan" {
  project      = var.project_id
  account_id   = "${var.environment}-github-actions-plan"
  display_name = "GitHub Actions Terraform plan (${var.environment})"
}

resource "google_service_account_iam_member" "github_actions_plan_wif" {
  service_account_id = google_service_account.github_actions_plan.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}
