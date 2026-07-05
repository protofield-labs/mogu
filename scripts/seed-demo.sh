#!/usr/bin/env bash
# Seed demo personas, collections, and sample social graph (#46).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (postgresql://app_user:...@127.0.0.1:5432/app)" >&2
  exit 1
fi

cd "${ROOT}/apps/web"
pnpm exec tsx scripts/seed-demo.ts
