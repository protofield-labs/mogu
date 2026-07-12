from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from agent.service import InvestigationService
from agent.scanner import SecretScanner
from app.auth import verify_pubsub_oidc, verify_task_oidc
from app.config import get_settings
from app.db import Database
from app.deadline import DeadlineExceeded, RequestDeadline
from app.external import GitHubApiSender, SlackApiSender
from app.ingest import IngestService
from app.noise import IngestResult, InvestigationReady
from app.worker import OutboxWorker

logger = logging.getLogger(__name__)


class OutboxTaskBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outbox_id: UUID


def create_app(
    investigation_service: InvestigationService | None = None,
    outbox_worker: OutboxWorker | None = None,
) -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="incident-agent", version="0.1.0")
    db = Database(settings.dsn)
    ingest_service = IngestService(db, settings)
    investigations = investigation_service or InvestigationService(db, settings)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "mode": settings.service_mode}

    active_paths: set[str] = set()
    if settings.service_mode == "ingest":
        active_paths.add("/pubsub/alerts")

        @app.post("/pubsub/alerts")
        async def pubsub_alerts(request: Request) -> JSONResponse:
            verify_pubsub_oidc(request, settings)
            deadline = RequestDeadline.create(settings.absolute_deadline_seconds)

            try:
                body = await request.json()
            except Exception as exc:
                raise HTTPException(status_code=400, detail="invalid json") from exc

            try:
                result = ingest_service.handle_pubsub(body, deadline)
                if isinstance(result, InvestigationReady):
                    result = await investigations.investigate(result, deadline)
            except DeadlineExceeded:
                return JSONResponse(status_code=503, content={"error": "deadline exceeded"})

            return _to_response(result)

    elif settings.service_mode == "worker":
        active_paths.add("/tasks/outbox")
        scanner = SecretScanner()
        worker = outbox_worker or OutboxWorker(
            db,
            slack=SlackApiSender(
                token=settings.slack_bot_token,
                channel=settings.slack_channel_id,
                team=settings.slack_team_id,
                scanner=scanner,
            ),
            github=GitHubApiSender(
                token=settings.github_token,
                repository=settings.github_repository,
                scanner=scanner,
            ),
            scanner=scanner,
            lease_seconds=settings.outbox_lease_seconds,
        )

        @app.post("/tasks/outbox")
        async def tasks_outbox(request: Request) -> JSONResponse:
            verify_task_oidc(request, settings)
            try:
                body = OutboxTaskBody.model_validate(await request.json())
            except Exception as exc:
                raise HTTPException(status_code=400, detail="invalid task body") from exc
            result = worker.handle(body.outbox_id)
            return JSONResponse(status_code=result.status_code, content=result.body)

    if "/pubsub/alerts" not in active_paths:
        @app.api_route("/pubsub/alerts", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
        async def pubsub_stub() -> JSONResponse:
            return JSONResponse(status_code=404, content={"error": "not available in this mode"})

    # Stub inactive component routes. The shared image exposes only one mode.
    for path in (
        "/slack/events",
        "/tasks/slack",
        "/tasks/outbox",
        "/tasks/investigate",
    ):
        if path in active_paths:
            continue
        route = _make_stub_route(path)
        app.add_api_route(path, route, methods=["GET", "POST", "PUT", "PATCH", "DELETE"])

    return app


def _make_stub_route(path: str):
    async def stub() -> JSONResponse:
        return JSONResponse(status_code=404, content={"error": f"{path} not available in ingest mode"})

    return stub


def _to_response(result: IngestResult | InvestigationReady) -> JSONResponse:
    if isinstance(result, InvestigationReady):
        return JSONResponse(
            status_code=503,
            content={
                "error": "investigation handler unavailable",
                "incident_id": str(result.incident_id),
                "delivery_message_id": result.delivery_message_id,
            },
        )
    return JSONResponse(status_code=result.status_code, content=result.body)


app = create_app()
