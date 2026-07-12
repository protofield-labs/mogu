from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app
from app.noise import IngestResult
from app.slack_ingress import MAX_SLACK_BODY_BYTES
from app.worker import WorkerResult


class FakeIngress:
    def __init__(self):
        self.calls: list[dict] = []

    def handle(self, raw_body, *, timestamp, signature):
        self.calls.append(
            {"raw": raw_body, "timestamp": timestamp, "signature": signature}
        )
        return IngestResult(200, {"ok": True})


class FakeFollowupWorker:
    def __init__(self):
        self.calls: list[dict] = []

    async def handle(self, event_id, *, task_name):
        self.calls.append({"event_id": event_id, "task_name": task_name})
        return WorkerResult(200, {"status": "replied"})


class FakeOutboxWorker:
    def handle(self, outbox_id):
        return WorkerResult(200, {"status": "sent"})


def _slack_app(monkeypatch, ingress):
    monkeypatch.setenv("SERVICE_MODE", "slack")
    from app.config import get_settings

    get_settings.cache_clear()
    client = TestClient(create_app(slack_ingress=ingress))
    get_settings.cache_clear()
    return client


def test_slack_mode_registers_only_slack_route(monkeypatch) -> None:
    client = _slack_app(monkeypatch, FakeIngress())

    assert client.post("/pubsub/alerts").status_code == 404
    assert client.post("/tasks/outbox").status_code == 404
    assert client.post("/tasks/slack").status_code == 404


def test_slack_route_rejects_oversized_content_length_before_ingress(
    monkeypatch,
) -> None:
    ingress = FakeIngress()
    client = _slack_app(monkeypatch, ingress)

    response = client.post(
        "/slack/events",
        content=b"{}",
        headers={"Content-Length": str(MAX_SLACK_BODY_BYTES + 1)},
    )

    assert response.status_code == 413
    assert ingress.calls == []


def test_slack_route_rejects_oversized_stream_before_ingress(monkeypatch) -> None:
    ingress = FakeIngress()
    client = _slack_app(monkeypatch, ingress)

    response = client.post(
        "/slack/events", content=b"x" * (MAX_SLACK_BODY_BYTES + 1)
    )

    assert response.status_code == 413
    assert ingress.calls == []


def test_slack_route_forwards_signature_headers(monkeypatch) -> None:
    ingress = FakeIngress()
    client = _slack_app(monkeypatch, ingress)

    response = client.post(
        "/slack/events",
        content=b'{"type":"url_verification"}',
        headers={
            "X-Slack-Request-Timestamp": "1720000000",
            "X-Slack-Signature": "v0=abc",
        },
    )

    assert response.status_code == 200
    assert ingress.calls[0]["timestamp"] == "1720000000"
    assert ingress.calls[0]["signature"] == "v0=abc"


def test_worker_slack_task_route_accepts_only_event_id(monkeypatch) -> None:
    monkeypatch.setenv("SERVICE_MODE", "worker")
    monkeypatch.setenv("WORKER_SKIP_AUTH", "true")
    from app.config import get_settings

    get_settings.cache_clear()
    followup = FakeFollowupWorker()
    client = TestClient(
        create_app(outbox_worker=FakeOutboxWorker(), slack_followup_worker=followup)
    )

    ok = client.post(
        "/tasks/slack",
        json={"event_id": "EvABC12345"},
        headers={"X-CloudTasks-TaskName": "slack-EvABC12345"},
    )
    extra = client.post(
        "/tasks/slack",
        json={"event_id": "EvABC12345", "team_id": "T0123456"},
    )

    assert ok.status_code == 200
    assert followup.calls == [
        {"event_id": "EvABC12345", "task_name": "slack-EvABC12345"}
    ]
    assert extra.status_code == 400
    get_settings.cache_clear()


def test_worker_slack_task_route_requires_oidc_before_body(monkeypatch) -> None:
    monkeypatch.setenv("SERVICE_MODE", "worker")
    monkeypatch.delenv("WORKER_SKIP_AUTH", raising=False)
    monkeypatch.setenv(
        "TASK_SERVICE_ACCOUNT_EMAIL", "task@example.iam.gserviceaccount.com"
    )
    from app.config import get_settings

    get_settings.cache_clear()
    client = TestClient(
        create_app(
            outbox_worker=FakeOutboxWorker(),
            slack_followup_worker=FakeFollowupWorker(),
        )
    )

    response = client.post("/tasks/slack", content=b"not-json")

    assert response.status_code == 401
    get_settings.cache_clear()
