from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


def _parse_csv(value: str | None) -> frozenset[str]:
    if not value:
        return frozenset()
    return frozenset(part.strip() for part in value.split(",") if part.strip())


@dataclass(frozen=True)
class Settings:
    service_mode: str
    db_host: str
    db_name: str
    db_user: str
    db_password: str
    allowed_resources: frozenset[str]
    allowed_alert_policies: frozenset[str]
    pubsub_audience: str
    pubsub_push_sa_email: str
    ingest_skip_auth: bool
    max_embedding_budget: int
    max_investigation_budget: int
    l4_cosine_threshold: float
    self_exclude_resource_prefixes: tuple[str, ...]
    l3_storm_threshold: int
    l3_storm_window_seconds: int
    l2_grouping_window_seconds: int
    absolute_deadline_seconds: int
    lease_seconds: int
    embedding_lease_seconds: int
    google_cloud_project: str = ""
    vertex_location: str = "asia-northeast1"
    embedding_model: str = "text-embedding-005"
    embedding_backend: str = "vertex"
    agent_model: str = "gemini-2.5-flash"

    @property
    def dsn(self) -> str:
        return (
            f"host={self.db_host} dbname={self.db_name} "
            f"user={self.db_user} password={self.db_password}"
        )


@lru_cache
def get_settings() -> Settings:
    node_env = os.environ.get("NODE_ENV", "").lower()
    default_embedding_backend = "vertex" if node_env == "production" else "deterministic"
    embedding_backend = os.environ.get(
        "EMBEDDING_BACKEND", default_embedding_backend
    ).lower()
    if embedding_backend not in {"deterministic", "vertex"}:
        raise ValueError("EMBEDDING_BACKEND must be deterministic or vertex")
    if node_env == "production" and embedding_backend != "vertex":
        raise ValueError("production requires EMBEDDING_BACKEND=vertex")

    return Settings(
        service_mode=os.environ.get("SERVICE_MODE", "ingest"),
        db_host=os.environ.get("DB_HOST", "localhost"),
        db_name=os.environ.get("DB_NAME", "mogu"),
        db_user=os.environ.get("DB_USER", "ops_ingest"),
        db_password=os.environ.get("DB_PASSWORD", ""),
        allowed_resources=_parse_csv(os.environ.get("ALLOWED_RESOURCES")),
        allowed_alert_policies=_parse_csv(os.environ.get("ALLOWED_ALERT_POLICIES")),
        pubsub_audience=os.environ.get("PUBSUB_AUDIENCE", ""),
        pubsub_push_sa_email=os.environ.get("PUBSUB_PUSH_SA_EMAIL", ""),
        ingest_skip_auth=os.environ.get("INGEST_SKIP_AUTH", "").lower() == "true"
        and node_env != "production",
        max_embedding_budget=int(os.environ.get("MAX_EMBEDDING_BUDGET", "100")),
        max_investigation_budget=int(os.environ.get("MAX_INVESTIGATION_BUDGET", "50")),
        l4_cosine_threshold=float(os.environ.get("L4_COSINE_THRESHOLD", "0.85")),
        self_exclude_resource_prefixes=tuple(
            prefix.strip()
            for prefix in os.environ.get("SELF_EXCLUDE_RESOURCE_PREFIXES", "incident-agent").split(",")
            if prefix.strip()
        ),
        l3_storm_threshold=int(os.environ.get("L3_STORM_THRESHOLD", "10")),
        l3_storm_window_seconds=int(os.environ.get("L3_STORM_WINDOW_SECONDS", "300")),
        l2_grouping_window_seconds=int(os.environ.get("L2_GROUPING_WINDOW_SECONDS", "900")),
        absolute_deadline_seconds=int(os.environ.get("ABSOLUTE_DEADLINE_SECONDS", "540")),
        lease_seconds=int(os.environ.get("LEASE_SECONDS", "600")),
        embedding_lease_seconds=int(os.environ.get("EMBEDDING_LEASE_SECONDS", "60")),
        google_cloud_project=os.environ.get("GOOGLE_CLOUD_PROJECT", ""),
        vertex_location=os.environ.get("VERTEX_LOCATION", "asia-northeast1"),
        embedding_model=os.environ.get("EMBEDDING_MODEL", "text-embedding-005"),
        embedding_backend=embedding_backend,
        agent_model=os.environ.get("INCIDENT_AGENT_MODEL", "gemini-2.5-flash"),
    )
