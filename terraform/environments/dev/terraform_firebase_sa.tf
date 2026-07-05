# Service account for Terraform Firebase API calls (#14).
# End-user ADC is not supported by firebase.googleapis.com; impersonate this SA instead.
resource "google_service_account" "terraform_firebase" {
  project      = var.project_id
  account_id   = "${var.environment}-terraform-firebase"
  display_name = "Terraform Firebase bootstrap (${var.environment})"
}

resource "google_project_iam_member" "terraform_firebase_admin" {
  project = var.project_id
  role    = "roles/firebase.admin"
  member  = "serviceAccount:${google_service_account.terraform_firebase.email}"
}

# Required when user_project_override bills API quota to the target project.
resource "google_project_iam_member" "terraform_firebase_service_usage_consumer" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageConsumer"
  member  = "serviceAccount:${google_service_account.terraform_firebase.email}"
}

# addFirebase may enable firebase.googleapis.com on the project.
resource "google_project_iam_member" "terraform_firebase_service_usage_admin" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageAdmin"
  member  = "serviceAccount:${google_service_account.terraform_firebase.email}"
}

resource "google_service_account_iam_member" "terraform_firebase_impersonation" {
  for_each = var.terraform_firebase_impersonators

  service_account_id = google_service_account.terraform_firebase.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = each.value
}

resource "google_service_account_iam_member" "terraform_firebase_act_as" {
  for_each = var.terraform_firebase_impersonators

  service_account_id = google_service_account.terraform_firebase.name
  role               = "roles/iam.serviceAccountUser"
  member             = each.value
}

# CI plan job reads Firebase resources via the same impersonation pattern.
resource "google_service_account_iam_member" "terraform_firebase_impersonation_plan" {
  service_account_id = google_service_account.terraform_firebase.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.github_actions_plan.email}"
}

resource "google_service_account_iam_member" "terraform_firebase_act_as_plan" {
  service_account_id = google_service_account.terraform_firebase.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions_plan.email}"
}
