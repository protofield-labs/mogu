from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from agent.scanner import SecretScanner
from agent.tools import (
    BoundInvestigationTools,
    GoogleObservationClient,
    IncidentToolScope,
    ToolScopeError,
    build_resource_query,
)


class FakeObservationClient:
    def __init__(self, *, log_payload: dict | None = None):
        self.calls: list[tuple[str, object, datetime, datetime]] = []
        self.log_payload = log_payload or {"entries": []}

    def get_metrics(self, query, *, start: datetime, end: datetime):
        self.calls.append(("metrics", query, start, end))
        return {"series": [{"value": 1}]}

    def get_logs(self, query, *, start: datetime, end: datetime):
        self.calls.append(("logs", query, start, end))
        return self.log_payload


class FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class FakeAuthorizedSession:
    def __init__(self):
        self.get_call = None
        self.post_call = None

    def get(self, url, *, params, timeout):
        self.get_call = (url, params, timeout)
        return FakeResponse({"timeSeries": []})

    def post(self, url, *, json, timeout):
        self.post_call = (url, json, timeout)
        return FakeResponse({"entries": []})


class NoopDB:
    @contextmanager
    def connection(self):
        yield None


class SimilarCursor:
    def __init__(self):
        self.sql = ""
        self.params = ()

    def execute(self, sql, params):
        self.sql = sql
        self.params = params
        return self

    def fetchall(self):
        return [
            {
                "id": uuid4(),
                "resolved_at": datetime(2026, 7, 1, tzinfo=timezone.utc),
                "created_at": datetime(2026, 6, 30, tzinfo=timezone.utc),
                "rca_hypothesis": (
                    "仮説: connection pool exhaustion\n"
                    "根拠:\n- connection count reached the limit"
                ),
                "github_issue": "https://github.com/example/repo/issues/1",
            }
        ]


class SimilarDB:
    def __init__(self):
        self.cursor = SimilarCursor()

    @contextmanager
    def connection(self):
        yield self.cursor


def _tools(observation: FakeObservationClient) -> BoundInvestigationTools:
    return BoundInvestigationTools(
        NoopDB(),
        IncidentToolScope(
            incident_id=uuid4(),
            project_id="test-project",
            resource="cloud_run/dev-web",
            alert_policy="dev-web-latency",
            embedding=[0.0] * 768,
        ),
        observation,
        SecretScanner(),
        clock=lambda: datetime(2026, 7, 12, 0, 0, tzinfo=timezone.utc),
    )


def test_tools_use_fixed_resource_and_sixty_minute_window() -> None:
    observation = FakeObservationClient()
    tools = _tools(observation)

    tools.get_metrics()
    tools.get_logs()

    assert len(observation.calls) == 2
    for _, query, start, end in observation.calls:
        assert query.resource_type == "cloud_run_revision"
        assert query.label_name == "service_name"
        assert query.label_value == "dev-web"
        assert (end - start).total_seconds() == 3600


def test_logs_are_scanned_at_tool_exit() -> None:
    observation = FakeObservationClient(
        log_payload={"entries": [{"message": "token=super-secret-value"}]}
    )

    result = _tools(observation).get_logs()

    assert result["entries"][0]["message"] == "[REDACTED]"
    assert "super-secret-value" not in str(result)


def test_split_log_secret_causes_fixed_tool_rejection() -> None:
    observation = FakeObservationClient(
        log_payload={"entries": [{"chunks": ["gh", "p_abcdefghijklmnopqrstuv"]}]}
    )
    tools = _tools(observation)

    result = tools.get_logs()

    assert result == {"error": "tool output rejected by safety policy"}
    assert tools.scan_failed is True


@pytest.mark.parametrize(
    "resource",
    ["cloud_run/../../other", "other/service", "cloud_run/service/name"],
)
def test_resource_scope_rejects_broadening(resource: str) -> None:
    with pytest.raises(ToolScopeError):
        build_resource_query(resource)


def test_google_clients_build_server_owned_filters() -> None:
    session = FakeAuthorizedSession()
    client = GoogleObservationClient("test-project", session=session)
    query = build_resource_query("cloud_run/dev-web")
    start = datetime(2026, 7, 11, 23, 0, tzinfo=timezone.utc)
    end = datetime(2026, 7, 12, 0, 0, tzinfo=timezone.utc)

    client.get_metrics(query, start=start, end=end)
    client.get_logs(query, start=start, end=end)

    _, metric_params, _ = session.get_call
    assert 'resource.labels.service_name = "dev-web"' in metric_params["filter"]
    assert metric_params["interval.startTime"] == "2026-07-11T23:00:00Z"
    _, log_body, _ = session.post_call
    assert log_body["resourceNames"] == ["projects/test-project"]
    assert 'timestamp >= "2026-07-11T23:00:00Z"' in log_body["filter"]
    assert "severity >= WARNING" in log_body["filter"]
    assert log_body["pageSize"] == 200


def test_similar_search_uses_only_reviewed_resolved_cases_and_top_three() -> None:
    database = SimilarDB()
    tools = BoundInvestigationTools(
        database,
        IncidentToolScope(
            incident_id=uuid4(),
            project_id="test-project",
            resource="cloud_run/dev-web",
            alert_policy="dev-web-latency",
            embedding=[0.0] * 768,
        ),
        FakeObservationClient(),
        SecretScanner(),
    )

    result = tools.search_similar_incidents()

    assert "status = 'resolved'" in database.cursor.sql
    assert "rca_reviewed = true" in database.cursor.sql
    assert "rca_hypothesis IS NOT NULL" in database.cursor.sql
    assert "LIMIT 3" in database.cursor.sql
    assert result["incidents"][0]["cause"] == "connection pool exhaustion"
