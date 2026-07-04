terraform {
  required_version = ">= 1.11, < 2.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "7.39.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6, < 4.0"
    }
  }
}
