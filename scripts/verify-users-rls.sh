#!/usr/bin/env bash
# Verify users RLS policies using the app connection user (not Cloud SQL admin).
# Requires Cloud SQL Auth Proxy on localhost:5432 and DATABASE_URL in the environment.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (postgresql://app_user:...@127.0.0.1:5432/app)" >&2
  exit 1
fi

cd "${ROOT}/apps/web"
pnpm exec tsx scripts/verify-users-rls.ts
