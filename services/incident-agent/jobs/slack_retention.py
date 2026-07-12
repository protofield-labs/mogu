"""Retention job for I6 (docs/incident-agent.md §11).

- Deletes ops.slack_events rows more than 7 days after completion.
- Deletes Vertex AI Sessions 30 days after incident resolution; failures are
  surfaced through a counter metric and a non-zero exit code (ops alert).
"""

from __future__ import annotations

import asyncio
import json
import logging

from app.config import get_settings
from app.db import Database
from app.followup import build_session_service, delete_incident_session
from app.slack_events import (
    delete_expired_slack_events,
    list_session_cleanup_incidents,
)
from app.telemetry import configure_telemetry, record_session_cleanup_failed

logger = logging.getLogger(__name__)


def main() -> int:
    settings = get_settings()
    configure_telemetry(
        project_id=settings.google_cloud_project,
        service_name="incident-agent-slack-retention",
    )
    db = Database(settings.dsn)

    deleted_events = delete_expired_slack_events(
        db, retention_days=settings.slack_events_retention_days
    )

    expired = list_session_cleanup_incidents(
        db, retention_days=settings.session_retention_days
    )
    session_failures = 0
    sessions_deleted = 0
    sessions_skipped = 0
    if settings.session_backend != "vertex":
        # In-memory sessions never outlive the worker process; there is nothing
        # this job can delete. Report skips instead of a false success so a
        # production misconfiguration (missing SESSION_BACKEND=vertex) is visible.
        sessions_skipped = len(expired)
        if expired:
            logger.warning(
                "session backend is not vertex; %d expired sessions were not deleted",
                len(expired),
            )
    else:
        session_service, app_name = build_session_service(settings)
        for incident_id in expired:
            try:
                deleted = asyncio.run(
                    delete_incident_session(
                        session_service,
                        app_name=app_name,
                        incident_id=str(incident_id),
                    )
                )
                if deleted:
                    sessions_deleted += 1
            except Exception:
                session_failures += 1
                record_session_cleanup_failed()
                logger.warning("session deletion failed", exc_info=True)

    print(
        json.dumps(
            {
                "deleted_events": deleted_events,
                "sessions_deleted": sessions_deleted,
                "sessions_skipped": sessions_skipped,
                "session_failures": session_failures,
            },
            sort_keys=True,
        )
    )
    return 1 if session_failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
