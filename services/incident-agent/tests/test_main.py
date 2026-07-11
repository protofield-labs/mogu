from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.self_exclude import is_self_excluded


def test_self_exclude_incident_agent_resource() -> None:
    settings = Settings(
        service_mode="ingest",
        db_host="localhost",
        db_name="mogu",
        db_user="ops_ingest",
        db_password="",
        allowed_resources=frozenset(),
        allowed_alert_policies=frozenset(),
        pubsub_audience="",
        pubsub_push_sa_email="",
        ingest_skip_auth=True,
        max_embedding_budget=100,
        max_investigation_budget=50,
        l4_cosine_threshold=0.85,
        self_exclude_resource_prefixes=("incident-agent",),
        l3_storm_threshold=10,
        l3_storm_window_seconds=300,
        l2_grouping_window_seconds=900,
        absolute_deadline_seconds=540,
        lease_seconds=600,
        embedding_lease_seconds=60,
    )
    assert is_self_excluded("incident-agent-ingest", settings)
    assert is_self_excluded("cloud_run/incident-agent-worker", settings)
    assert not is_self_excluded("cloud_run/dev-web", settings)


def test_slack_route_returns_404_in_ingest_mode(monkeypatch) -> None:
    monkeypatch.setenv("SERVICE_MODE", "ingest")
    monkeypatch.setenv("INGEST_SKIP_AUTH", "true")
    from app.config import get_settings

    get_settings.cache_clear()
    client = TestClient(create_app())
    assert client.post("/slack/events").status_code == 404
    assert client.post("/tasks/outbox").status_code == 404
    get_settings.cache_clear()
