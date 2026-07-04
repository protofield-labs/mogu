#!/usr/bin/env bash
set -euo pipefail

target_dir="${1:-.}"

echo "==> terraform fmt"
terraform fmt -check -recursive "${target_dir}"

echo "==> terraform validate"
if compgen -G "${target_dir}/*.tf" >/dev/null; then
  terraform -chdir="${target_dir}" init -backend=false -input=false
  terraform -chdir="${target_dir}" validate
else
  echo "No Terraform files found in target directory; skipping validate."
fi

echo "==> tflint"
tflint --init
tflint --recursive

echo "==> trivy"
trivy config \
  --exit-code 1 \
  --severity CRITICAL,HIGH \
  "${target_dir}"

echo "PASS: Terraform checks completed."
