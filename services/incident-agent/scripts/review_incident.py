from __future__ import annotations

import argparse
from uuid import UUID

from agent.scanner import SecretScanner
from app.config import get_settings
from app.db import Database
from app.outbox import review_incident


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Resolve an incident and promote its human-reviewed RCA."
    )
    parser.add_argument("incident_id", type=UUID)
    parser.add_argument("--rca", required=True, help="Final human-reviewed RCA summary")
    parser.add_argument("--reviewer", required=True, help="Operator/reviewer identity")
    args = parser.parse_args()

    settings = get_settings()
    if settings.db_user != "ops_reviewer":
        parser.error("DB_USER must be ops_reviewer")
    scanner = SecretScanner()
    scanner.assert_safe({"rca": args.rca, "reviewer": args.reviewer})
    reviewed = review_incident(
        Database(settings.dsn),
        incident_id=args.incident_id,
        rca_summary=args.rca,
        reviewer_id=args.reviewer,
    )
    if not reviewed:
        parser.error("incident is not an unresolved analyzed/escalated incident")
    print(f"reviewed {args.incident_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
