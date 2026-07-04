#!/usr/bin/env bash
# Bootstrap Firebase on an existing GCP project and sync GitHub deploy secrets.
#
# Prerequisites:
#   - gcloud auth application-default login (same account as terraform_firebase_impersonators)
#   - Accept Firebase Terms of Service once in the browser (see step 1)
#
# Usage: ./scripts/bootstrap-firebase.sh [root-module-directory]
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_dir="${1:-terraform/environments/dev}"
project_id="${TF_VAR_project_id:-mogu-501309}"

echo "==> Set ADC quota project (${project_id})"
gcloud auth application-default set-quota-project "${project_id}"

echo "==> Check Firebase Terms of Service"
echo
echo "If terraform apply fails with 403 on google_firebase_project, open this URL"
echo "while signed in as your GCP account and add Firebase to the project:"
echo
echo "  https://console.firebase.google.com/project/${project_id}/overview"
echo
echo "Accept the Firebase ToS if prompted, then re-run this script."
echo

echo "==> terraform apply (${target_dir})"
terraform -chdir="${repo_root}/${target_dir}" apply

echo
echo "==> Firebase Web SDK config"
terraform -chdir="${repo_root}/${target_dir}" output -json firebase_web_config

if command -v gh >/dev/null 2>&1; then
  echo
  read -r -p "Sync NEXT_PUBLIC_FIREBASE_* to GitHub Secrets? [y/N] " answer
  if [[ "${answer}" =~ ^[Yy]$ ]]; then
    "${repo_root}/scripts/sync-firebase-github-secrets.sh" "${target_dir}"
  fi
else
  echo
  echo "Install gh CLI and run:"
  echo "  ./scripts/sync-firebase-github-secrets.sh ${target_dir}"
fi

echo
echo "PASS: Firebase bootstrap completed."
