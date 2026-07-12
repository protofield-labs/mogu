from __future__ import annotations

import hashlib
import hmac
import json
import time

import pytest

import app.slack_ingress as ingress_module
from app.config import Settings
from app.dispatcher import AlreadyExistsError
from app.slack_ingress import (
    MAX_SLACK_BODY_BYTES,
    SlackIngressService,
    slack_task_name,
    verify_slack_signature,
)

SECRET = "test-signing-secret"


def _settings(**overrides) -> Settings:
    values = dict(
        service_mode="slack",
        db_host="localhost",
        db_name="mogu",
        db_user="ops_slack_ingress",
        db_password="",
        allowed_resources=frozenset({"cloud_run/dev-web"}),
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
        slack_signing_secret=SECRET,
        allowed_slack_team_ids=frozenset({"T0123456"}),
        allowed_slack_channel_ids=frozenset({"C0123456"}),
        allowed_slack_user_ids=frozenset({"U0123456"}),
        slack_user_rate_limit_per_minute=5,
        slack_thread_rate_limit_per_hour=10,
    )
    values.update(overrides)
    return Settings(**values)


class FakeEnqueuer:
    def __init__(self, *, fail: Exception | None = None):
        self.fail = fail
        self.calls: list[tuple[str, dict[str, str]]] = []

    def enqueue(self, *, task_name: str, body: dict[str, str]) -> None:
        self.calls.append((task_name, body))
        if self.fail is not None:
            raise self.fail


def _mention_body(**overrides) -> dict:
    event = {
        "type": "app_mention",
        "channel": "C0123456",
        "user": "U0123456",
        "ts": "1720000000.000100",
        "thread_ts": "1719999999.000100",
        "text": "<@UBOT9999> what changed?",
    }
    event.update(overrides.pop("event", {}))
    body = {
        "type": "event_callback",
        "event_id": "EvABC12345",
        "team_id": "T0123456",
        "event": event,
    }
    body.update(overrides)
    return body


def _sign(raw: bytes, *, secret: str = SECRET, ts: str | None = None) -> tuple[str, str]:
    timestamp = ts or str(int(time.time()))
    digest = hmac.new(
        secret.encode(), b"v0:" + timestamp.encode() + b":" + raw, hashlib.sha256
    ).hexdigest()
    return timestamp, f"v0={digest}"


def _handle(
    service: SlackIngressService,
    body: dict,
    *,
    secret: str = SECRET,
    ts: str | None = None,
):
    raw = json.dumps(body).encode()
    timestamp, signature = _sign(raw, secret=secret, ts=ts)
    return service.handle(raw, timestamp=timestamp, signature=signature)


@pytest.fixture
def register_calls(monkeypatch):
    calls: list = []

    def fake_register(db, *, request, rate_limit_per_minute):
        calls.append((request, rate_limit_per_minute))
        return "registered"

    monkeypatch.setattr(ingress_module, "register_slack_event", fake_register)
    return calls


def test_signature_requires_secret_and_fresh_timestamp() -> None:
    raw = b"{}"
    ts, sig = _sign(raw)
    assert verify_slack_signature(
        raw_body=raw, timestamp=ts, signature=sig, signing_secret=SECRET
    )
    # Unset secret is default-deny.
    assert not verify_slack_signature(
        raw_body=raw, timestamp=ts, signature=sig, signing_secret=""
    )
    # Stale timestamp beyond the 5-minute window is rejected.
    old_ts, old_sig = _sign(raw, ts=str(int(time.time()) - 600))
    assert not verify_slack_signature(
        raw_body=raw, timestamp=old_ts, signature=old_sig, signing_secret=SECRET
    )
    # Wrong secret is rejected.
    _, forged = _sign(raw, secret="other-secret")
    assert not verify_slack_signature(
        raw_body=raw, timestamp=ts, signature=forged, signing_secret=SECRET
    )


def test_invalid_signature_returns_401_without_db(register_calls) -> None:
    service = SlackIngressService(object(), _settings(), FakeEnqueuer())
    raw = json.dumps(_mention_body()).encode()

    result = service.handle(raw, timestamp=str(int(time.time())), signature="v0=bad")

    assert result.status_code == 401
    assert register_calls == []


def test_oversized_body_is_rejected_before_parsing(register_calls) -> None:
    service = SlackIngressService(object(), _settings(), FakeEnqueuer())
    raw = b"x" * (MAX_SLACK_BODY_BYTES + 1)

    result = service.handle(raw, timestamp="1", signature="v0=ignored")

    assert result.status_code == 413
    assert register_calls == []


def test_url_verification_challenge_after_signature(register_calls) -> None:
    service = SlackIngressService(object(), _settings(), FakeEnqueuer())

    result = _handle(
        service, {"type": "url_verification", "challenge": "challenge-token"}
    )

    assert result.status_code == 200
    assert result.body == {"challenge": "challenge-token"}
    assert register_calls == []


def test_empty_allowlists_are_default_deny(register_calls) -> None:
    enqueuer = FakeEnqueuer()
    service = SlackIngressService(
        object(),
        _settings(allowed_slack_user_ids=frozenset()),
        enqueuer,
    )

    result = _handle(service, _mention_body())

    assert result.status_code == 200
    assert result.body == {"ok": True}
    assert register_calls == []
    assert enqueuer.calls == []


def test_non_allowlisted_user_is_acked_without_db(register_calls) -> None:
    enqueuer = FakeEnqueuer()
    service = SlackIngressService(object(), _settings(), enqueuer)

    result = _handle(service, _mention_body(event={"user": "U9999999"}))

    assert result.status_code == 200
    assert register_calls == []
    assert enqueuer.calls == []


@pytest.mark.parametrize(
    "overrides",
    [
        {"event_id": "not-an-event-id"},
        {"team_id": "X0123456"},
        {"event": {"channel": "D0123456"}},  # DM channels are forbidden (§11)
        {"event": {"ts": "invalid", "thread_ts": None}},
    ],
)
def test_malformed_identifiers_are_rejected(register_calls, overrides) -> None:
    service = SlackIngressService(object(), _settings(), FakeEnqueuer())

    result = _handle(service, _mention_body(**overrides))

    assert result.status_code == 200
    assert register_calls == []


def test_allowed_mention_registers_and_enqueues_before_ack(register_calls) -> None:
    enqueuer = FakeEnqueuer()
    service = SlackIngressService(object(), _settings(), enqueuer)

    result = _handle(service, _mention_body())

    assert result.status_code == 200
    request, rate_limit = register_calls[0]
    assert request.event_id == "EvABC12345"
    assert request.task_name == slack_task_name("EvABC12345")
    assert request.thread_ts == "1719999999.000100"
    assert rate_limit == 5
    assert enqueuer.calls == [
        ("slack-EvABC12345", {"event_id": "EvABC12345"})
    ]


def test_rate_limited_event_is_acked_without_task(monkeypatch) -> None:
    monkeypatch.setattr(
        ingress_module, "register_slack_event", lambda *a, **k: "rate_limited"
    )
    enqueuer = FakeEnqueuer()
    service = SlackIngressService(object(), _settings(), enqueuer)

    result = _handle(service, _mention_body())

    assert result.status_code == 200
    assert enqueuer.calls == []


def test_duplicate_event_is_acked_without_task(monkeypatch) -> None:
    monkeypatch.setattr(
        ingress_module, "register_slack_event", lambda *a, **k: "duplicate"
    )
    enqueuer = FakeEnqueuer()
    service = SlackIngressService(object(), _settings(), enqueuer)

    result = _handle(service, _mention_body())

    assert result.status_code == 200
    assert enqueuer.calls == []


def test_pending_event_retries_enqueue(monkeypatch) -> None:
    monkeypatch.setattr(
        ingress_module, "register_slack_event", lambda *a, **k: "retry_enqueue"
    )
    enqueuer = FakeEnqueuer(fail=AlreadyExistsError("slack-EvABC12345"))
    service = SlackIngressService(object(), _settings(), enqueuer)

    result = _handle(service, _mention_body())

    assert result.status_code == 200
    assert len(enqueuer.calls) == 1


def test_enqueue_failure_returns_503_for_slack_retry(register_calls) -> None:
    enqueuer = FakeEnqueuer(fail=RuntimeError("cloud tasks down"))
    service = SlackIngressService(object(), _settings(), enqueuer)

    result = _handle(service, _mention_body())

    assert result.status_code == 503


def test_thread_mention_without_thread_ts_uses_message_ts(register_calls) -> None:
    service = SlackIngressService(object(), _settings(), FakeEnqueuer())
    body = _mention_body()
    del body["event"]["thread_ts"]

    result = _handle(service, body)

    assert result.status_code == 200
    request, _ = register_calls[0]
    assert request.thread_ts == "1720000000.000100"
