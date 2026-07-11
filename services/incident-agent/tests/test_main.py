from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import _to_response, create_app
from app.noise import IngestResult, InvestigationReady
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


def test_investigation_ready_is_not_acked_before_analysis_commit() -> None:
    token = uuid.uuid4()
    result = InvestigationReady(
        incident_id=uuid.uuid4(),
        delivery_message_id="message-1",
        investigation_token=token,
        work_token=token,
        alert={"v": 1},
        embedding=[0.0] * 768,
        playbook_hint=None,
        loop_budget_seconds=120,
    )

    response = _to_response(result)

    assert response.status_code == 503


def test_pubsub_route_runs_investigation_before_ack(monkeypatch) -> None:
    token = uuid.uuid4()
    ready = InvestigationReady(
        incident_id=uuid.uuid4(),
        delivery_message_id="message-2",
        investigation_token=token,
        work_token=token,
        alert={"v": 1},
        embedding=[0.0] * 768,
        playbook_hint=None,
        loop_budget_seconds=120,
    )

    class FakeIngestService:
        def __init__(self, db, settings):
            pass

        def handle_pubsub(self, body, deadline):
            return ready

    class FakeInvestigationService:
        called = False

        async def investigate(self, result, deadline):
            assert result is ready
            self.called = True
            return IngestResult(200, {"action": "analyzed"})

    monkeypatch.setenv("SERVICE_MODE", "ingest")
    monkeypatch.setenv("INGEST_SKIP_AUTH", "true")
    monkeypatch.setattr("app.main.IngestService", FakeIngestService)
    from app.config import get_settings

    get_settings.cache_clear()
    investigations = FakeInvestigationService()
    client = TestClient(create_app(investigations))

    response = client.post("/pubsub/alerts", json={"message": {}})

    assert response.status_code == 200
    assert response.json() == {"action": "analyzed"}
    assert investigations.called is True
    get_settings.cache_clear()
