module "storage" {
  source = "../../modules/storage"

  project_id  = var.project_id
  bucket_name = "${var.project_id}-${var.environment}-app"
  location    = var.region
  labels      = local.labels

  depends_on = [google_project_service.services]
}
