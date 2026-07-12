from __future__ import annotations

from uuid import UUID

import app.worker as worker_module
from agent.scanner import SecretScanner
from app.external import SlackReference
from app.outbox import ClaimResult, ReferenceConflictError
from app.worker import OutboxWorker
from tests.test_external import _record


class FakeSlack:
    def __init__(self):
        self.calls = 0
        self.updates = 0

    def send(self, record):
        self.calls += 1
        return SlackReference(team="T1", channel="C1", thread="1.2")

    def update(self, record):
        self.updates += 1
        return SlackReference(team="T1", channel="C1", thread="1.2")


class FakeGitHub:
    def __init__(self, *, fail: bool = False):
        self.fail = fail
        self.calls = 0

    def send(self, record):
        self.calls += 1
        if self.fail:
            raise RuntimeError("temporary")
        return "https://github.com/acme/repo/issues/1"


def test_worker_reads_db_record_and_commits_external_reference(monkeypatch) -> None:
    record = _record("slack")
    monkeypatch.setattr(
        worker_module, "claim_outbox", lambda *args, **kwargs: ClaimResult("claimed", record)
    )
    saved = {}
    monkeypatch.setattr(
        worker_module,
        "mark_outbox_sent",
        lambda *args, **kwargs: saved.update(kwargs) or True,
    )
    slack = FakeSlack()
    worker = OutboxWorker(
        object(),
        slack=slack,
        github=FakeGitHub(),
        scanner=SecretScanner(),
    )

    result = worker.handle(record.id)

    assert result.status_code == 200
    assert slack.calls == 1
    assert saved["external_ref"] == "C1:1.2"
    assert saved["slack_team"] == "T1"


def test_worker_updates_existing_slack_message(monkeypatch) -> None:
    record = _record(
        "slack",
        dependency_external_ref="C1:1.2",
        payload={"text": "更新", "operation": "update"},
    )
    monkeypatch.setattr(
        worker_module, "claim_outbox", lambda *args, **kwargs: ClaimResult("claimed", record)
    )
    monkeypatch.setattr(
        worker_module, "mark_outbox_sent", lambda *args, **kwargs: True
    )
    slack = FakeSlack()
    worker = OutboxWorker(
        object(),
        slack=slack,
        github=FakeGitHub(),
        scanner=SecretScanner(),
    )

    result = worker.handle(record.id)

    assert result.status_code == 200
    assert slack.calls == 0
    assert slack.updates == 1


def test_worker_releases_retryable_external_failure(monkeypatch) -> None:
    record = _record("github_issue")
    monkeypatch.setattr(
        worker_module, "claim_outbox", lambda *args, **kwargs: ClaimResult("claimed", record)
    )
    released = {}
    monkeypatch.setattr(
        worker_module,
        "release_or_fail_outbox",
        lambda *args, **kwargs: released.update(kwargs) or "pending",
    )
    worker = OutboxWorker(
        object(),
        slack=FakeSlack(),
        github=FakeGitHub(fail=True),
        scanner=SecretScanner(),
    )

    result = worker.handle(record.id)

    assert result.status_code == 503
    assert result.body["state"] == "pending"
    assert released["record"] == record


def test_worker_stops_stale_task_after_idempotent_external_success(monkeypatch) -> None:
    record = _record("github_issue")
    monkeypatch.setattr(
        worker_module, "claim_outbox", lambda *args, **kwargs: ClaimResult("claimed", record)
    )
    monkeypatch.setattr(
        worker_module, "mark_outbox_sent", lambda *args, **kwargs: False
    )
    worker = OutboxWorker(
        object(),
        slack=FakeSlack(),
        github=FakeGitHub(),
        scanner=SecretScanner(),
    )

    result = worker.handle(record.id)

    assert result.status_code == 200
    assert result.body == {"status": "stale_delivery_completed"}


def test_worker_secret_failure_is_permanently_failed_without_external_call(
    monkeypatch,
) -> None:
    record = _record("slack", payload={"text": "token=do-not-send"})
    monkeypatch.setattr(
        worker_module, "claim_outbox", lambda *args, **kwargs: ClaimResult("claimed", record)
    )
    monkeypatch.setattr(
        worker_module, "fail_outbox_safety", lambda *args, **kwargs: True
    )
    slack = FakeSlack()
    worker = OutboxWorker(
        object(),
        slack=slack,
        github=FakeGitHub(),
        scanner=SecretScanner(),
    )

    result = worker.handle(UUID(str(record.id)))

    assert result.status_code == 200
    assert result.body["state"] == "failed"
    assert slack.calls == 0


def test_worker_reference_conflict_fails_permanently_without_retry(
    monkeypatch,
) -> None:
    record = _record("github_issue")
    monkeypatch.setattr(
        worker_module, "claim_outbox", lambda *args, **kwargs: ClaimResult("claimed", record)
    )

    def raise_conflict(*args, **kwargs):
        raise ReferenceConflictError("incident GitHub reference conflict")

    monkeypatch.setattr(worker_module, "mark_outbox_sent", raise_conflict)
    failed = {}
    monkeypatch.setattr(
        worker_module,
        "fail_outbox_safety",
        lambda *args, **kwargs: failed.update(kwargs) or True,
    )
    released = []
    monkeypatch.setattr(
        worker_module,
        "release_or_fail_outbox",
        lambda *args, **kwargs: released.append(kwargs) or "pending",
    )
    github = FakeGitHub()
    worker = OutboxWorker(
        object(),
        slack=FakeSlack(),
        github=github,
        scanner=SecretScanner(),
    )

    result = worker.handle(record.id)

    assert result.status_code == 200
    assert result.body["state"] == "failed"
    assert github.calls == 1
    assert failed["record"] == record
    assert released == []


def test_worker_treats_sent_task_retry_as_success(monkeypatch) -> None:
    monkeypatch.setattr(
        worker_module, "claim_outbox", lambda *args, **kwargs: ClaimResult("sent")
    )
    worker = OutboxWorker(
        object(),
        slack=FakeSlack(),
        github=FakeGitHub(),
        scanner=SecretScanner(),
    )

    result = worker.handle(UUID("11111111-2222-4333-8444-555555555555"))

    assert result.status_code == 200
    assert result.body == {"status": "already_sent"}
