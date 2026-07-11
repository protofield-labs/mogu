from __future__ import annotations

import argparse
from uuid import UUID

from app.config import get_settings
from app.db import Database
from app.outbox import replay_failed_outbox


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Replay one failed outbox row with a new task generation."
    )
    parser.add_argument("outbox_id", type=UUID)
    args = parser.parse_args()
    settings = get_settings()
    if settings.db_user != "ops_operator":
        parser.error("DB_USER must be ops_operator")
    replayed = replay_failed_outbox(Database(settings.dsn), args.outbox_id)
    if not replayed:
        parser.error("outbox row does not exist or is not failed")
    print(f"replayed {args.outbox_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
