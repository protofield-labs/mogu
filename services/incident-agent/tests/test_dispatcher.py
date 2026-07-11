from __future__ import annotations

import base64
import json
from uuid import UUID, uuid4

import app.dispatcher as dispatcher_module
from app.dispatcher import (
    AlreadyExistsError,
    GoogleCloudTasksEnqueuer,
    OutboxDispatcher,
    deterministic_task_name,
)


class FakeEnqueuer:
    def __init__(self):
        self.calls: list[tuple[str, dict[str, str]]] = []

    def enqueue(self, *, task_name: str, body: dict[str, str]) -> None:
        self.calls.append((task_name, body))
        if task_name.endswith("-1"):
            raise AlreadyExistsError(task_name)
        if task_name.endswith("-2"):
            raise RuntimeError("temporary failure")


class FakeResponse:
    def __init__(self, status_code: int = 200):
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError("http error")


class FakeSession:
    def __init__(self, status_code: int = 200):
        self.status_code = status_code
        self.call = None

    def post(self, url, *, json, timeout):
        self.call = (url, json, timeout)
        return FakeResponse(self.status_code)


def test_dispatcher_uses_deterministic_generation_and_leaves_failures(
    monkeypatch,
) -> None:
    ids = [uuid4(), uuid4(), uuid4()]
    monkeypatch.setattr(
        dispatcher_module,
        "list_dispatchable_outbox",
        lambda db, limit: [(ids[0], 0), (ids[1], 1), (ids[2], 2)],
    )
    enqueuer = FakeEnqueuer()

    result = OutboxDispatcher(object(), enqueuer).dispatch()

    assert result.scanned == 3
    assert result.enqueued == 1
    assert result.already_exists == 1
    assert result.failed == 1
    assert enqueuer.calls[0] == (
        deterministic_task_name(ids[0], 0),
        {"outbox_id": str(ids[0])},
    )


def test_google_enqueuer_sends_only_outbox_id_with_oidc() -> None:
    session = FakeSession()
    outbox_id = UUID("11111111-2222-4333-8444-555555555555")
    enqueuer = GoogleCloudTasksEnqueuer(
        project_id="project",
        location="asia-northeast1",
        queue="outbox",
        worker_url="https://worker.example",
        service_account_email="task@example.iam.gserviceaccount.com",
        audience="https://worker.example",
        session=session,
    )

    enqueuer.enqueue(
        task_name=deterministic_task_name(outbox_id, 3),
        body={"outbox_id": str(outbox_id)},
    )

    _, request, _ = session.call
    task = request["task"]
    decoded = json.loads(base64.b64decode(task["httpRequest"]["body"]))
    assert decoded == {"outbox_id": str(outbox_id)}
    assert task["name"].endswith(f"/tasks/outbox-{outbox_id}-3")
    assert task["httpRequest"]["oidcToken"]["audience"] == "https://worker.example"


def test_google_enqueuer_treats_http_409_as_already_exists() -> None:
    enqueuer = GoogleCloudTasksEnqueuer(
        project_id="project",
        location="location",
        queue="queue",
        worker_url="https://worker.example",
        service_account_email="task@example.iam.gserviceaccount.com",
        audience="https://worker.example",
        session=FakeSession(status_code=409),
    )

    try:
        enqueuer.enqueue(task_name="outbox-id-0", body={"outbox_id": "id"})
    except AlreadyExistsError:
        pass
    else:
        raise AssertionError("409 must be treated as ALREADY_EXISTS")
