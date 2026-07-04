provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Firebase / Identity Platform APIs require quota billing and SA impersonation
# (end-user ADC is not supported by firebase.googleapis.com).
provider "google-beta" {
  alias                       = "firebase"
  project                     = var.project_id
  region                      = var.region
  billing_project             = var.project_id
  user_project_override       = true
  impersonate_service_account = local.terraform_firebase_sa_email
}

# The Billing Budgets API requires a quota project on every request,
# so the budget resource uses this aliased provider.
provider "google" {
  alias                 = "billing"
  project               = var.project_id
  region                = var.region
  billing_project       = var.project_id
  user_project_override = true
}
