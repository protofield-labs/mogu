#!/usr/bin/env bash
# Run Terraform plan in CI with backend init and strict delete/replace checks.
set -euo pipefail

target_dir="${1:?Usage: ./scripts/ci/terraform-plan.sh <root-module-directory>}"
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

required_vars=(
  TF_VAR_project_id
  TF_VAR_region
  TF_VAR_owner
  TF_VAR_billing_account_id
)

for name in "${required_vars[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: ${name} is required for CI plan." >&2
    exit 1
  fi
done

summary_file="${PLAN_SUMMARY_FILE:-${RUNNER_TEMP:-/tmp}/plan-summary.json}"

echo "==> terraform init (GCS backend)"
terraform -chdir="${target_dir}" init -input=false

echo "==> terraform plan (PLAN_STRICT=true)"
PLAN_STRICT=true PLAN_SUMMARY_FILE="${summary_file}" \
  "${repo_root}/scripts/plan.sh" "${target_dir}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "plan_summary_file=${summary_file}" >> "${GITHUB_OUTPUT}"
fi
