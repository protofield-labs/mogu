provider "google" {
  project = var.project_id
  region  = var.region
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
