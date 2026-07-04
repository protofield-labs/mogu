#!/usr/bin/env bash
set -euo pipefail

target_dir="${1:?Usage: ./scripts/plan.sh <root-module-directory>}"
strict_mode="${PLAN_STRICT:-false}"

if ! command -v terraform >/dev/null 2>&1; then
  echo "ERROR: terraform is required."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required."
  exit 1
fi

umask 077
tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

plan_file="${tmp_dir}/plan.tfplan"
summary_file="${tmp_dir}/summary.json"

echo "==> terraform plan"
terraform \
  -chdir="${target_dir}" \
  plan \
  -out="${plan_file}"

echo "==> sanitized plan summary"
terraform \
  -chdir="${target_dir}" \
  show \
  -json \
  "${plan_file}" |
jq '
  {
    summary: {
      create: ([.resource_changes[]? | select(.change.actions == ["create"])] | length),
      update: ([.resource_changes[]? | select(.change.actions == ["update"])] | length),
      delete: ([.resource_changes[]? | select((.change.actions | index("delete")) and ((.change.actions | index("create")) | not))] | length),
      replace: ([.resource_changes[]? | select((.change.actions | index("delete")) and (.change.actions | index("create")))] | length)
    },
    resource_changes: [
      .resource_changes[]?
      | select(.change.actions != ["no-op"])
      | {
          address: .address,
          type: .type,
          actions: .change.actions
        }
    ]
  }
' > "${summary_file}"

cat "${summary_file}"

delete_count="$(jq -r '.summary.delete' "${summary_file}")"
replace_count="$(jq -r '.summary.replace' "${summary_file}")"

if [[ "${delete_count}" -gt 0 || "${replace_count}" -gt 0 ]]; then
  echo
  echo "WARN: Delete or replace actions detected."
  echo "Delete:  ${delete_count}"
  echo "Replace: ${replace_count}"

  if [[ "${strict_mode}" == "true" ]]; then
    echo "BLOCKED: PLAN_STRICT=true"
    exit 1
  fi
fi

echo
echo "PASS: Terraform plan completed."
echo "INFO: Temporary plan files were removed."
