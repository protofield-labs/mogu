from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
import re
from typing import Any, Callable, Protocol
from uuid import UUID

import google.auth
from google.auth.transport.requests import AuthorizedSession

from agent.scanner import SecretScanError, SecretScanner
from app.db import Database, vector_to_pg

MAX_LOG_ENTRIES = 200
MAX_METRIC_SERIES = 100
LOOKBACK_MINUTES = 60
_RESOURCE_PART = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class ToolScopeError(Exception):
    """The incident resource cannot be mapped to a fixed read-only scope."""


@dataclass(frozen=True)
class IncidentToolScope:
    incident_id: UUID
    project_id: str
    resource: str
    alert_policy: str
    embedding: list[float]


@dataclass(frozen=True)
class ResourceQuery:
    resource_type: str
    label_name: str
    label_value: str
    metric_type: str


class ObservationClient(Protocol):
    def get_metrics(self, query: ResourceQuery, *, start: datetime, end: datetime) -> Any:
        ...

    def get_logs(self, query: ResourceQuery, *, start: datetime, end: datetime) -> Any:
        ...


def build_resource_query(
    resource: str,
    *,
    project_id: str | None = None,
    alert_policy: str = "",
) -> ResourceQuery:
    try:
        kind, identifier = resource.split("/", 1)
    except ValueError as exc:
        raise ToolScopeError("unsupported incident resource") from exc
    if not _RESOURCE_PART.fullmatch(identifier):
        raise ToolScopeError("invalid incident resource identifier")
    if kind == "cloud_run":
        metric_type = (
            "run.googleapis.com/request_latencies"
            if "latency" in alert_policy.lower()
            else "run.googleapis.com/request_count"
        )
        return ResourceQuery(
            resource_type="cloud_run_revision",
            label_name="service_name",
            label_value=identifier,
            metric_type=metric_type,
        )
    if kind == "cloud_sql":
        if not project_id or not _RESOURCE_PART.fullmatch(project_id):
            raise ToolScopeError("valid project is required for Cloud SQL scope")
        return ResourceQuery(
            resource_type="cloudsql_database",
            label_name="database_id",
            label_value=f"{project_id}:{identifier}",
            metric_type=(
                "cloudsql.googleapis.com/database/network/connections"
                if "connection" in alert_policy.lower()
                else "cloudsql.googleapis.com/database/cpu/utilization"
            ),
        )
    raise ToolScopeError("unsupported incident resource kind")


class GoogleObservationClient:
    def __init__(
        self,
        project_id: str,
        session: AuthorizedSession | None = None,
    ):
        if not project_id or not _RESOURCE_PART.fullmatch(project_id):
            raise ToolScopeError("valid Google Cloud project is required")
        self._project_id = project_id
        if session is None:
            credentials, _ = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            session = AuthorizedSession(credentials)
        self._session = session

    def get_metrics(
        self, query: ResourceQuery, *, start: datetime, end: datetime
    ) -> dict[str, Any]:
        metric_filter = (
            f'metric.type = "{query.metric_type}" AND '
            f'resource.type = "{query.resource_type}" AND '
            f'resource.labels.{query.label_name} = "{query.label_value}"'
        )
        response = self._session.get(
            f"https://monitoring.googleapis.com/v3/projects/"
            f"{self._project_id}/timeSeries",
            params={
                "filter": metric_filter,
                "interval.startTime": _rfc3339(start),
                "interval.endTime": _rfc3339(end),
                "view": "FULL",
                "pageSize": MAX_METRIC_SERIES,
            },
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        series = payload.get("timeSeries", [])
        if not isinstance(series, list):
            raise RuntimeError("invalid Monitoring response")
        return {
            "window_minutes": LOOKBACK_MINUTES,
            "series": [
                {
                    "metric_type": item.get("metric", {}).get("type"),
                    "resource_type": item.get("resource", {}).get("type"),
                    "points": item.get("points", [])[:120],
                }
                for item in series[:MAX_METRIC_SERIES]
                if isinstance(item, dict)
            ],
        }

    def get_logs(
        self, query: ResourceQuery, *, start: datetime, end: datetime
    ) -> dict[str, Any]:
        log_filter = (
            f'timestamp >= "{_rfc3339(start)}" AND '
            f'timestamp <= "{_rfc3339(end)}" AND '
            "severity >= WARNING AND "
            f'resource.type = "{query.resource_type}" AND '
            f'resource.labels.{query.label_name} = "{query.label_value}"'
        )
        response = self._session.post(
            "https://logging.googleapis.com/v2/entries:list",
            json={
                "resourceNames": [f"projects/{self._project_id}"],
                "filter": log_filter,
                "orderBy": "timestamp desc",
                "pageSize": MAX_LOG_ENTRIES,
            },
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        entries = payload.get("entries", [])
        if not isinstance(entries, list):
            raise RuntimeError("invalid Logging response")
        return {
            "window_minutes": LOOKBACK_MINUTES,
            "entries": [
                _summarize_log_entry(entry)
                for entry in entries[:MAX_LOG_ENTRIES]
                if isinstance(entry, dict)
            ],
        }


class BoundInvestigationTools:
    """ADK function tools bound to one DB-authenticated incident scope."""

    def __init__(
        self,
        db: Database,
        scope: IncidentToolScope,
        observation_client: ObservationClient,
        scanner: SecretScanner,
        clock: Callable[[], datetime] | None = None,
    ):
        self._db = db
        self._scope = scope
        self._query = build_resource_query(
            scope.resource,
            project_id=scope.project_id,
            alert_policy=scope.alert_policy,
        )
        self._observation = observation_client
        self._scanner = scanner
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self.scan_failed = False

    def get_metrics(self) -> dict[str, Any]:
        """Return fixed-scope metrics for this incident's last 60 minutes."""
        now = self._clock()
        return self._safe_call(
            lambda: self._observation.get_metrics(
                self._query,
                start=now - timedelta(minutes=LOOKBACK_MINUTES),
                end=now,
            )
        )

    def get_logs(self) -> dict[str, Any]:
        """Return at most 200 fixed-scope WARNING+ logs from the last 60 minutes."""
        now = self._clock()
        return self._safe_call(
            lambda: self._observation.get_logs(
                self._query,
                start=now - timedelta(minutes=LOOKBACK_MINUTES),
                end=now,
            )
        )

    def search_similar_incidents(self) -> dict[str, Any]:
        """Return up to three reviewed and resolved incidents by cosine distance."""

        def query() -> dict[str, Any]:
            with self._db.connection() as conn:
                rows = conn.execute(
                    """
                    SELECT id, resolved_at, created_at, rca_hypothesis, github_issue
                      FROM ops.incidents
                     WHERE status = 'resolved'
                       AND rca_reviewed = true
                       AND rca_hypothesis IS NOT NULL
                       AND embedding IS NOT NULL
                     ORDER BY embedding <=> %s::vector ASC,
                              resolved_at DESC,
                              id ASC
                     LIMIT 3
                    """,
                    (vector_to_pg(self._scope.embedding),),
                ).fetchall()
            return {
                "incidents": [
                    {
                        "date": (row["resolved_at"] or row["created_at"]).date().isoformat(),
                        "cause": _reviewed_cause(row["rca_hypothesis"]),
                        "issue": row["github_issue"],
                    }
                    for row in rows
                ]
            }

        return self._safe_call(query)

    def _safe_call(self, operation: Callable[[], Any]) -> dict[str, Any]:
        try:
            result = operation()
            sanitized = self._scanner.sanitize_payload(result)
            if not isinstance(sanitized, dict):
                raise SecretScanError("tool output must be an object")
            return sanitized
        except SecretScanError:
            self.scan_failed = True
            return {"error": "tool output rejected by safety policy"}
        except Exception:
            return {"error": "observation temporarily unavailable"}


def _summarize_log_entry(entry: dict[str, Any]) -> dict[str, Any]:
    payload: Any = entry.get("textPayload")
    if payload is None:
        payload = entry.get("jsonPayload")
    if payload is None:
        payload = entry.get("protoPayload")
    if isinstance(payload, (dict, list)):
        payload = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    if payload is not None and not isinstance(payload, str):
        payload = str(payload)
    return {
        "timestamp": entry.get("timestamp"),
        "severity": entry.get("severity"),
        "message": payload,
    }


def _rfc3339(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _reviewed_cause(summary: str) -> str:
    first_line = summary.splitlines()[0]
    if first_line.startswith("仮説: "):
        return first_line.removeprefix("仮説: ")
    return first_line
