from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Generator
from uuid import UUID

import psycopg
from psycopg.rows import dict_row


class Database:
    def __init__(self, dsn: str):
        self._dsn = dsn

    @contextmanager
    def connection(self) -> Generator[psycopg.Connection[Any], None, None]:
        conn = psycopg.connect(self._dsn, row_factory=dict_row)
        try:
            yield conn
        finally:
            conn.close()

    @contextmanager
    def transaction(self) -> Generator[psycopg.Connection[Any], None, None]:
        with self.connection() as conn:
            with conn.transaction():
                yield conn


from app.keys import sha256_hex


def advisory_lock_key(resource: str, alert_policy: str) -> int:
    """Deterministic advisory lock key from resource+policy (stable across processes)."""
    combined = f"{resource}:{alert_policy}"
    digest = sha256_hex(combined)
    return int(digest[:16], 16) & 0x7FFFFFFFFFFFFFFF


def storm_advisory_lock_key(storm_key: str) -> int:
    digest = sha256_hex(storm_key)
    return int(digest[:16], 16) & 0x7FFFFFFFFFFFFFFF


@contextmanager
def resource_advisory_lock(
    conn: psycopg.Connection[Any], resource: str, alert_policy: str
) -> Generator[None, None, None]:
    key = advisory_lock_key(resource, alert_policy)
    conn.execute("SELECT pg_advisory_xact_lock(%s)", (key,))
    yield


@contextmanager
def storm_advisory_lock(conn: psycopg.Connection[Any], storm_key: str) -> Generator[None, None, None]:
    key = storm_advisory_lock_key(storm_key)
    conn.execute("SELECT pg_advisory_xact_lock(%s)", (key,))
    yield


def reserve_embedding_budget(conn: psycopg.Connection[Any], max_budget: int) -> bool:
    row = conn.execute(
        "SELECT ops.reserve_embedding_budget(%s) AS reserved",
        (max_budget,),
    ).fetchone()
    return bool(row and row["reserved"])


def reserve_investigation_budget(conn: psycopg.Connection[Any], max_budget: int) -> bool:
    row = conn.execute(
        "SELECT ops.reserve_investigation_budget(%s) AS reserved",
        (max_budget,),
    ).fetchone()
    return bool(row and row["reserved"])


def vector_to_pg(embedding: list[float]) -> str:
    return "[" + ",".join(str(v) for v in embedding) + "]"


def parse_vector(value: Any) -> list[float] | None:
    if value is None:
        return None
    if isinstance(value, list):
        return [float(v) for v in value]
    if isinstance(value, str):
        inner = value.strip("[]")
        if not inner:
            return []
        return [float(part) for part in inner.split(",")]
    return None
