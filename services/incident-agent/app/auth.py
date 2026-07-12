from __future__ import annotations

from fastapi import HTTPException, Request

from app.config import Settings


def verify_pubsub_oidc(request: Request, settings: Settings) -> None:
    """Verify Pub/Sub push OIDC JWT (§7-9)."""
    if settings.ingest_skip_auth:
        return

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")

    token = auth_header[7:]
    if not settings.pubsub_audience or not settings.pubsub_push_sa_email:
        raise HTTPException(status_code=500, detail="pubsub auth not configured")

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="google-auth unavailable") from exc

    try:
        claims = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            audience=settings.pubsub_audience,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="invalid oidc token") from exc

    email = claims.get("email")
    if email != settings.pubsub_push_sa_email:
        raise HTTPException(status_code=403, detail="unauthorized service account")

    issuer = claims.get("iss", "")
    if issuer not in ("https://accounts.google.com", "accounts.google.com"):
        raise HTTPException(status_code=401, detail="invalid issuer")


def verify_task_oidc(request: Request, settings: Settings) -> None:
    """Verify Cloud Tasks OIDC before parsing the task body (§7-9)."""
    if settings.worker_skip_auth:
        return
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    if not settings.task_service_account_email or not settings.worker_audience:
        raise HTTPException(status_code=500, detail="task auth not configured")

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="google-auth unavailable") from exc

    try:
        claims = id_token.verify_oauth2_token(
            auth_header[7:],
            google_requests.Request(),
            audience=settings.worker_audience,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="invalid oidc token") from exc
    if claims.get("email") != settings.task_service_account_email:
        raise HTTPException(status_code=403, detail="unauthorized service account")
    if claims.get("iss", "") not in (
        "https://accounts.google.com",
        "accounts.google.com",
    ):
        raise HTTPException(status_code=401, detail="invalid issuer")
