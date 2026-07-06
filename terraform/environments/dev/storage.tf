module "storage" {
  source = "../../modules/storage"

  project_id  = var.project_id
  bucket_name = "${var.project_id}-${var.environment}-app"
  location    = var.region
  labels      = local.labels

  # #97: Browser signed-URL PUT from Cloud Run origin requires bucket CORS.
  cors_origins = [module.cloud_run.uri]

  depends_on = [google_project_service.services]
}
