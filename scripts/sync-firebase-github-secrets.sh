#!/usr/bin/env bash
# Sync Firebase Web SDK config from Terraform output to GitHub Actions secrets.
# Usage: ./scripts/sync-firebase-github-secrets.sh [root-module-directory]
set -euo pipefail

target_dir="${1:-terraform/environments/dev}"
repo="${GITHUB_REPO:-protofield-labs/mogu}"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI is required."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required."
  exit 1
fi

config="$(terraform -chdir="${target_dir}" output -json firebase_web_config)"

api_key="$(jq -r '.api_key' <<<"${config}")"
auth_domain="$(jq -r '.auth_domain' <<<"${config}")"
project_id="$(jq -r '.project_id' <<<"${config}")"
app_id="$(jq -r '.app_id' <<<"${config}")"

for name in \
  NEXT_PUBLIC_FIREBASE_API_KEY \
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID \
  NEXT_PUBLIC_FIREBASE_APP_ID; do
  case "${name}" in
    NEXT_PUBLIC_FIREBASE_API_KEY) value="${api_key}" ;;
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) value="${auth_domain}" ;;
    NEXT_PUBLIC_FIREBASE_PROJECT_ID) value="${project_id}" ;;
    NEXT_PUBLIC_FIREBASE_APP_ID) value="${app_id}" ;;
  esac

  echo "==> gh secret set ${name} (repo: ${repo})"
  gh secret set "${name}" --repo "${repo}" --body "${value}"
done

echo
echo "PASS: GitHub secrets updated from terraform output firebase_web_config."
