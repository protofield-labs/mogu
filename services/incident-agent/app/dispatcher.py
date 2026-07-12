from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

import google.auth
from google.auth.transport.requests import AuthorizedSession

from app.db import Database
from app.outbox import list_dispatchable_outbox


class AlreadyExistsError(Exception):
    """The deterministic Cloud Task already exists."""


class TaskEnqueuer(Protocol):
    def enqueue(self, *, task_name: str, body: dict[str, str]) -> None:
        ...


@dataclass(frozen=True)
class DispatchResult:
    scanned: int
    enqueued: int
    already_exists: int
    failed: int


def deterministic_task_name(outbox_id: UUID, generation: int) -> str:
    if generation < 0:
        raise ValueError("generation must not be negative")
    return f"outbox-{outbox_id}-{generation}"


class GoogleCloudTasksEnqueuer:
    def __init__(
        self,
        *,
        project_id: str,
        location: str,
        queue: str,
        worker_url: str,
        service_account_email: str,
        audience: str,
        task_path: str = "/tasks/outbox",
        session: AuthorizedSession | None = None,
    ):
        required = {
            "project_id": project_id,
            "location": location,
            "queue": queue,
            "worker_url": worker_url,
            "service_account_email": service_account_email,
            "audience": audience,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(f"Cloud Tasks configuration missing: {', '.join(missing)}")
        self._parent = f"projects/{project_id}/locations/{location}/queues/{queue}"
        self._worker_url = worker_url.rstrip("/") + task_path
        self._service_account_email = service_account_email
        self._audience = audience
        if session is None:
            credentials, _ = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            session = AuthorizedSession(credentials)
        self._session = session

    def enqueue(self, *, task_name: str, body: dict[str, str]) -> None:
        encoded_body = base64.b64encode(
            json.dumps(body, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).decode("ascii")
        response = self._session.post(
            f"https://cloudtasks.googleapis.com/v2/{self._parent}/tasks",
            json={
                "task": {
                    "name": f"{self._parent}/tasks/{task_name}",
                    "httpRequest": {
                        "httpMethod": "POST",
                        "url": self._worker_url,
                        "headers": {"Content-Type": "application/json"},
                        "body": encoded_body,
                        "oidcToken": {
                            "serviceAccountEmail": self._service_account_email,
                            "audience": self._audience,
                        },
                    },
                }
            },
            timeout=20,
        )
        if response.status_code == 409:
            raise AlreadyExistsError(task_name)
        response.raise_for_status()


class OutboxDispatcher:
    def __init__(self, db: Database, enqueuer: TaskEnqueuer):
        self._db = db
        self._enqueuer = enqueuer

    def dispatch(self, *, limit: int = 100) -> DispatchResult:
        rows = list_dispatchable_outbox(self._db, limit=limit)
        enqueued = 0
        already_exists = 0
        failed = 0
        for outbox_id, generation in rows:
            task_name = deterministic_task_name(outbox_id, generation)
            try:
                self._enqueuer.enqueue(
                    task_name=task_name,
                    body={"outbox_id": str(outbox_id)},
                )
                enqueued += 1
            except AlreadyExistsError:
                already_exists += 1
            except Exception:
                # The DB row deliberately remains pending for the next 1-minute scan.
                failed += 1
        return DispatchResult(
            scanned=len(rows),
            enqueued=enqueued,
            already_exists=already_exists,
            failed=failed,
        )
