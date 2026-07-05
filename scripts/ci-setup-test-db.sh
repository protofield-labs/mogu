#!/usr/bin/env bash
# Create app_user + app database for CI guardrail tests (#30).
# Connects as the default postgres superuser; verification runs as app_user.
set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
APP_USER="${APP_USER:-app_user}"
APP_PASSWORD="${APP_PASSWORD:-ci}"
APP_DB="${APP_DB:-app}"

export PGPASSWORD

psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d postgres -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASSWORD}'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END \$\$;

DROP DATABASE IF EXISTS ${APP_DB};
CREATE DATABASE ${APP_DB} OWNER ${APP_USER};
SQL

echo "Prepared database ${APP_DB} owned by ${APP_USER}"
