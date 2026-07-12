"""Apply ops schema SQL migrations to Cloud SQL (#369).

Uses the application database user (cloudsqlsuperuser / owner) created by
Terraform. LOGIN roles (ops_ingest, etc.) must already exist from Terraform
before 003_ops_roles.sql runs.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

import psycopg

logger = logging.getLogger(__name__)

MIGRATION_FILES = (
    "001_ops_schema.sql",
    "002_budget_primitives.sql",
    "003_ops_roles.sql",
    "004_incident_review_gate.sql",
    "005_outbox_delivery_token.sql",
    "006_slack_retention_grants.sql",
)

TRACKING_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS public.incident_agent_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
"""


def _migrations_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "db" / "migrations"


def _conninfo() -> str:
    host = os.environ["DB_HOST"]
    name = os.environ["DB_NAME"]
    user = os.environ["DB_USER"]
    password = os.environ["DB_PASSWORD"]
    sslmode = os.environ.get("DB_SSLMODE", "require")
    return (
        f"host={host} dbname={name} user={user} password={password} "
        f"sslmode={sslmode}"
    )


def _ensure_tracking_table(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(TRACKING_TABLE_SQL)


def _is_applied(conn: psycopg.Connection, filename: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM public.incident_agent_migrations WHERE filename = %s",
            (filename,),
        )
        return cur.fetchone() is not None


def _record_applied(conn: psycopg.Connection, filename: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO public.incident_agent_migrations (filename) VALUES (%s)",
            (filename,),
        )


def apply_migrations(conn: psycopg.Connection) -> None:
    root = _migrations_dir()
    _ensure_tracking_table(conn)
    for filename in MIGRATION_FILES:
        if _is_applied(conn, filename):
            logger.info("Skipping %s (already applied)", filename)
            continue
        path = root / filename
        if not path.is_file():
            raise FileNotFoundError(f"migration not found: {path}")
        sql = path.read_text(encoding="utf-8")
        logger.info("Applying %s", filename)
        with conn.cursor() as cur:
            cur.execute(sql)
        _record_applied(conn, filename)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        with psycopg.connect(_conninfo()) as conn:
            conn.autocommit = True
            apply_migrations(conn)
    except Exception:
        logger.exception("ops schema migration failed")
        return 1
    logger.info("ops schema migrations applied successfully")
    return 0


if __name__ == "__main__":
    sys.exit(main())
