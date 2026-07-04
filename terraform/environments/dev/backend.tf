terraform {
  backend "gcs" {
    bucket = "tfstate-mogu"
    prefix = "dev"
  }
}
