from __future__ import annotations

import json

from app.config import get_settings
from app.db import Database
from app.dispatcher import GoogleCloudTasksEnqueuer, OutboxDispatcher


def main() -> int:
    settings = get_settings()
    dispatcher = OutboxDispatcher(
        Database(settings.dsn),
        GoogleCloudTasksEnqueuer(
            project_id=settings.outbox_queue_project,
            location=settings.outbox_queue_location,
            queue=settings.outbox_queue_name,
            worker_url=settings.worker_url,
            service_account_email=settings.task_service_account_email,
            audience=settings.worker_audience,
        ),
    )
    result = dispatcher.dispatch()
    print(json.dumps(result.__dict__, sort_keys=True))
    return 1 if result.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
