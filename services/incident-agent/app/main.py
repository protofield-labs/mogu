from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.auth import verify_pubsub_oidc
from app.config import get_settings
from app.db import Database
from app.deadline import DeadlineExceeded, RequestDeadline
from app.ingest import IngestService
from app.noise import IngestResult, InvestigationReady

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="incident-agent", version="0.1.0")
    db = Database(settings.dsn)
    ingest_service = IngestService(db, settings)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "mode": settings.service_mode}

    if settings.service_mode == "ingest":

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
            except DeadlineExceeded:
                return JSONResponse(status_code=503, content={"error": "deadline exceeded"})

            return _to_response(result)

    else:
        @app.api_route("/pubsub/alerts", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
        async def pubsub_stub() -> JSONResponse:
            return JSONResponse(status_code=404, content={"error": "not available in this mode"})

    # Stub 404 for slack/worker routes (I2 scope)
    for path in (
        "/slack/events",
        "/tasks/slack",
        "/tasks/outbox",
        "/tasks/investigate",
    ):
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
            status_code=200,
            content={
                "action": "investigation_ready",
                "incident_id": str(result.incident_id),
                "delivery_message_id": result.delivery_message_id,
                "loop_budget_seconds": result.loop_budget_seconds,
            },
        )
    return JSONResponse(status_code=result.status_code, content=result.body)


app = create_app()
