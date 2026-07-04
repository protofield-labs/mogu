output "bucket_name" {
  description = "The bucket name."
  value       = google_storage_bucket.this.name
}

output "bucket_url" {
  description = "The gs:// URL of the bucket."
  value       = google_storage_bucket.this.url
}
