#!/usr/bin/env bash
# Guardrail verification (#30): CI final defense line for docs/spec.md §7.
# Requires DATABASE_URL (app_user, not superuser) and applied migrations.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (postgresql://app_user:...@127.0.0.1:5432/app)" >&2
  exit 1
fi

echo "==> verify-core-schema (savedCount column ban, depth>=2 anonymization)"
"${ROOT}/scripts/verify-core-schema.sh"

echo "==> verify-users-rls (public SELECT + self INSERT/UPDATE)"
"${ROOT}/scripts/verify-users-rls.sh"

echo "==> verify-recollect-rls (friend-visible spot copy + flag trigger)"
"${ROOT}/scripts/verify-recollect-rls.sh"

echo "==> verify-saved-count (circle DISTINCT added_by, #41)"
"${ROOT}/scripts/verify-saved-count.sh"

echo "==> verify-flags-rls (weekly summary + read, #38)"
"${ROOT}/scripts/verify-flags-rls.sh"

echo "==> verify-spots-rls (owned collection CRUD, #34)"
"${ROOT}/scripts/verify-spots-rls.sh"

echo "PASS: guardrail verifications completed"
