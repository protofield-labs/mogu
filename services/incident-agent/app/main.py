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
from app.config import Settings, get_settings
from app.db import Database
from app.deadline import DeadlineExceeded, RequestDeadline
from app.dispatcher import GoogleCloudTasksEnqueuer, TaskEnqueuer
from app.external import GitHubApiSender, SlackApiSender, SlackThreadApiClient
from app.followup import AdkFollowupRuntime, build_session_service
from app.ingest import IngestService
from app.noise import IngestResult, InvestigationReady
from app.slack_ingress import MAX_SLACK_BODY_BYTES, SlackIngressService
from app.slack_worker import SlackFollowupWorker
from app.telemetry import configure_telemetry
from app.worker import OutboxWorker

logger = logging.getLogger(__name__)


class OutboxTaskBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outbox_id: UUID


class SlackTaskBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: str


class _UnconfiguredEnqueuer:
    """Fail closed until the Slack Cloud Tasks queue is fully configured."""

    def enqueue(self, *, task_name: str, body: dict[str, str]) -> None:
        raise RuntimeError("Slack task queue is not configured")


def _build_slack_enqueuer(settings: Settings) -> TaskEnqueuer:
    try:
        return GoogleCloudTasksEnqueuer(
            project_id=settings.slack_queue_project,
            location=settings.slack_queue_location,
            queue=settings.slack_queue_name,
            worker_url=settings.worker_url,
            service_account_email=settings.task_service_account_email,
            audience=settings.worker_audience,
            task_path="/tasks/slack",
        )
    except ValueError:
        return _UnconfiguredEnqueuer()


async def _read_capped_body(request: Request) -> bytes | None:
    """§7-12: enforce 256 KiB via Content-Length and streaming read."""
    declared = request.headers.get("content-length")
    if declared is not None:
        try:
            if int(declared) > MAX_SLACK_BODY_BYTES:
                return None
        except ValueError:
            return None
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > MAX_SLACK_BODY_BYTES:
            return None
        chunks.append(chunk)
    return b"".join(chunks)


def create_app(
    investigation_service: InvestigationService | None = None,
    outbox_worker: OutboxWorker | None = None,
    slack_ingress: SlackIngressService | None = None,
    slack_followup_worker: SlackFollowupWorker | None = None,
) -> FastAPI:
    settings = get_settings()
    configure_telemetry(
        project_id=settings.google_cloud_project,
        service_name=f"incident-agent-{settings.service_mode}",
    )
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

    elif settings.service_mode == "slack":
        active_paths.add("/slack/events")
        ingress = slack_ingress or SlackIngressService(
            db, settings, _build_slack_enqueuer(settings)
        )

        @app.post("/slack/events")
        async def slack_events(request: Request) -> JSONResponse:
            raw_body = await _read_capped_body(request)
            if raw_body is None:
                # Rejected before signature computation, JSON parse, and DB (§7-12).
                return JSONResponse(
                    status_code=413, content={"error": "payload too large"}
                )
            result = ingress.handle(
                raw_body,
                timestamp=request.headers.get("X-Slack-Request-Timestamp"),
                signature=request.headers.get("X-Slack-Signature"),
            )
            return JSONResponse(status_code=result.status_code, content=result.body)

    elif settings.service_mode == "worker":
        active_paths.add("/tasks/outbox")
        active_paths.add("/tasks/slack")
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

        followup_holder: list[SlackFollowupWorker] = (
            [slack_followup_worker] if slack_followup_worker else []
        )

        def _get_followup_worker() -> SlackFollowupWorker:
            if not followup_holder:
                session_service, session_app = build_session_service(settings)
                followup_holder.append(
                    SlackFollowupWorker(
                        db,
                        settings,
                        gateway=SlackThreadApiClient(
                            token=settings.slack_bot_token,
                            scanner=scanner,
                        ),
                        runtime=AdkFollowupRuntime(
                            project_id=settings.google_cloud_project,
                            location=settings.vertex_location,
                            model_name=settings.agent_model,
                            session_service=session_service,
                            app_name=session_app,
                        ),
                        scanner=scanner,
                    )
                )
            return followup_holder[0]

        @app.post("/tasks/slack")
        async def tasks_slack(request: Request) -> JSONResponse:
            verify_task_oidc(request, settings)
            try:
                body = SlackTaskBody.model_validate(await request.json())
            except Exception as exc:
                raise HTTPException(status_code=400, detail="invalid task body") from exc
            try:
                followup = _get_followup_worker()
            except Exception:
                return JSONResponse(
                    status_code=503,
                    content={"error": "slack follow-up worker not configured"},
                )
            result = await followup.handle(
                body.event_id,
                task_name=request.headers.get("X-CloudTasks-TaskName"),
            )
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
