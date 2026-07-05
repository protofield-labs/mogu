#!/usr/bin/env bash
# Verify core schema DDL (#27): no savedCount column, depth>=2 flag anonymization.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (postgresql://app_user:...@127.0.0.1:5432/app)" >&2
  exit 1
fi

cd "${ROOT}/apps/web"
pnpm exec tsx scripts/verify-core-schema.ts
