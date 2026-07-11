from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import psycopg

from app.db import Database
from app.deadline import lease_expires_at, new_token


@dataclass(frozen=True)
class SaveAnalysisResult:
    success: bool
    status_code: int
    incident_id: UUID | None = None
    reason: str | None = None


@dataclass(frozen=True)
class RenewLeaseResult:
    success: bool
    new_token: UUID | None = None
    attempt_count: int | None = None


def expire_owner_lease(
    db: Database,
    *,
    incident_id: UUID,
    delivery_message_id: str,
    investigation_token: UUID,
    work_token: UUID,
) -> bool:
    """Expire mirrored owner leases with both current tokens."""
    with db.transaction() as conn:
        incident = conn.execute(
            """
            UPDATE ops.incidents
               SET lease_expires_at = now()
             WHERE id = %s
               AND investigation_token = %s
               AND status = 'investigating'
             RETURNING id
            """,
            (incident_id, investigation_token),
        ).fetchone()
        if not incident:
            return False
        delivery = conn.execute(
            """
            UPDATE ops.alert_deliveries
               SET work_lease_expires_at = now()
             WHERE message_id = %s
               AND incident_id = %s
               AND work_token = %s
               AND status = 'processing'
               AND is_owner = true
             RETURNING message_id
            """,
            (
                delivery_message_id,
                incident_id,
                work_token,
            ),
        ).fetchone()
        if not delivery:
            raise RuntimeError("partial lease expiration forbidden")
    return True


def renew_owner_lease(
    db: Database,
    *,
    incident_id: UUID,
    delivery_message_id: str,
    investigation_token: UUID,
    work_token: UUID,
    lease_seconds: int = 600,
) -> RenewLeaseResult:
    """Step 8: CAS renew both tokens when lease expired and attempt < 3."""
    new_tok = new_token()
    new_lease = lease_expires_at(lease_seconds)

    with db.transaction() as conn:
        incident = conn.execute(
            """
            UPDATE ops.incidents
               SET investigation_token = %s,
                   lease_expires_at = %s,
                   attempt_count = attempt_count + 1
             WHERE id = %s
               AND investigation_token = %s
               AND status = 'investigating'
               AND lease_expires_at < now()
               AND attempt_count < 3
             RETURNING attempt_count
            """,
            (new_tok, new_lease, incident_id, investigation_token),
        ).fetchone()

        if not incident:
            return RenewLeaseResult(success=False)

        delivery = conn.execute(
            """
            UPDATE ops.alert_deliveries
               SET work_token = %s,
                   work_lease_expires_at = %s
             WHERE message_id = %s
               AND incident_id = %s
               AND work_token = %s
               AND status = 'processing'
               AND is_owner = true
             RETURNING message_id
            """,
            (
                new_tok,
                new_lease,
                delivery_message_id,
                incident_id,
                work_token,
            ),
        ).fetchone()

        if not delivery:
            raise RuntimeError("partial token update forbidden")

    return RenewLeaseResult(
        success=True, new_token=new_tok, attempt_count=incident["attempt_count"]
    )


def save_owner_analysis(
    db: Database,
    *,
    incident_id: UUID,
    delivery_message_id: str,
    investigation_token: UUID,
    work_token: UUID,
    analysis: dict[str, Any],
    outbox_entries: list[dict[str, Any]] | None = None,
    escalate: bool = False,
) -> SaveAnalysisResult:
    """Step 9: CAS save analysis + outbox + analyzed/escalated + delivery completed."""
    target_status = "escalated" if escalate else "analyzed"
    entries = outbox_entries or []

    with db.transaction() as conn:
        incident = conn.execute(
            "SELECT status, merged_into, incident_kind FROM ops.incidents WHERE id = %s",
            (incident_id,),
        ).fetchone()
        delivery = conn.execute(
            """
            SELECT status, is_owner, incident_id
              FROM ops.alert_deliveries
             WHERE message_id = %s
            """,
            (delivery_message_id,),
        ).fetchone()

        if (
            incident
            and incident["status"] == "merged"
            and delivery
            and delivery["status"] == "completed"
            and delivery["incident_id"] == incident_id
        ):
            return SaveAnalysisResult(success=True, status_code=200, incident_id=incident_id)

        updated = conn.execute(
            """
            UPDATE ops.incidents
               SET status = %s,
                   severity = %s,
                   rca_hypothesis = %s,
                   loop_count = COALESCE(%s, loop_count),
                   token_cost = COALESCE(%s, token_cost),
                   playbook_used = COALESCE(%s, playbook_used),
                   lease_expires_at = now()
             WHERE id = %s
               AND investigation_token = %s
               AND status = 'investigating'
             RETURNING id
            """,
            (
                target_status,
                analysis.get("severity"),
                analysis.get("rca_hypothesis"),
                analysis.get("loop_count"),
                analysis.get("token_cost"),
                analysis.get("playbook_used"),
                incident_id,
                investigation_token,
            ),
        ).fetchone()

        if not updated:
            # Re-read for merged+completed path
            incident = conn.execute(
                "SELECT status FROM ops.incidents WHERE id = %s", (incident_id,)
            ).fetchone()
            delivery = conn.execute(
                """
                SELECT status, incident_id
                  FROM ops.alert_deliveries
                 WHERE message_id = %s
                """,
                (delivery_message_id,),
            ).fetchone()
            if (
                incident
                and incident["status"] == "merged"
                and delivery
                and delivery["status"] == "completed"
                and delivery["incident_id"] == incident_id
            ):
                return SaveAnalysisResult(success=True, status_code=200, incident_id=incident_id)
            return SaveAnalysisResult(
                success=False, status_code=500, reason="incident cas failed"
            )

        delivery_updated = conn.execute(
            """
            UPDATE ops.alert_deliveries
               SET status = 'completed',
                   is_owner = false,
                   completed_at = now(),
                   work_lease_expires_at = NULL
             WHERE message_id = %s
               AND incident_id = %s
               AND work_token = %s
               AND status = 'processing'
               AND is_owner = true
             RETURNING message_id
            """,
            (delivery_message_id, incident_id, work_token),
        ).fetchone()

        if not delivery_updated:
            raise RuntimeError("delivery cas failed after incident update")

        for entry in entries:
            conn.execute(
                """
                INSERT INTO ops.outbox (incident_id, destination, idempotency_key, payload, depends_on)
                VALUES (%s, %s, %s, %s::jsonb, %s)
                ON CONFLICT (idempotency_key) DO NOTHING
                """,
                (
                    incident_id,
                    entry["destination"],
                    entry["idempotency_key"],
                    json.dumps(entry["payload"]),
                    entry.get("depends_on"),
                ),
            )

        if incident and incident["incident_kind"] == "storm":
            create_storm_merge_outboxes(conn, storm_id=incident_id)

    return SaveAnalysisResult(success=True, status_code=200, incident_id=incident_id)


def create_storm_merge_outboxes(
    conn: psycopg.Connection[Any],
    *,
    storm_id: UUID,
) -> None:
    """Create old-issue comment→close chains after the storm Issue outbox."""
    issue_outbox = conn.execute(
        """
        SELECT id
          FROM ops.outbox
         WHERE incident_id = %s
           AND destination = 'github_issue'
         ORDER BY created_at ASC
         LIMIT 1
        """,
        (storm_id,),
    ).fetchone()
    if not issue_outbox:
        raise RuntimeError("storm GitHub Issue outbox is required")
    merged_rows = conn.execute(
        """
        SELECT id
          FROM ops.incidents
         WHERE merged_into = %s
           AND status = 'merged'
           AND github_issue IS NOT NULL
         ORDER BY id
        """,
        (storm_id,),
    ).fetchall()
    for merged in merged_rows:
        comment_key = f"storm-merge-comment:{merged['id']}:{storm_id}"
        comment = conn.execute(
            """
            INSERT INTO ops.outbox (
                incident_id, destination, idempotency_key, payload, depends_on
            )
            VALUES (%s, 'github_comment', %s, %s::jsonb, %s)
            ON CONFLICT (idempotency_key) DO UPDATE
              SET idempotency_key = EXCLUDED.idempotency_key
            RETURNING id
            """,
            (
                merged["id"],
                comment_key,
                json.dumps(
                    {
                        "kind": "storm_merge",
                        "text": "This incident was consolidated into a storm incident.",
                    }
                ),
                issue_outbox["id"],
            ),
        ).fetchone()
        conn.execute(
            """
            INSERT INTO ops.outbox (
                incident_id, destination, idempotency_key, payload, depends_on
            )
            VALUES (%s, 'github_close', %s, %s::jsonb, %s)
            ON CONFLICT (idempotency_key) DO NOTHING
            """,
            (
                merged["id"],
                f"storm-merge-close:{merged['id']}:{storm_id}",
                json.dumps({"kind": "storm_merge_close"}),
                comment["id"],
            ),
        )


def save_final_escalation(
    db: Database,
    *,
    incident_id: UUID,
    delivery_message_id: str,
    investigation_token: UUID,
    work_token: UUID,
) -> SaveAnalysisResult:
    """Step 9: attempt=3 failure — fixed outbox + escalated."""
    payload = {
        "text": "Automated investigation failed after maximum attempts. Manual review required."
    }
    return save_owner_analysis(
        db,
        incident_id=incident_id,
        delivery_message_id=delivery_message_id,
        investigation_token=investigation_token,
        work_token=work_token,
        analysis={"severity": "high", "rca_hypothesis": "Investigation exhausted"},
        outbox_entries=[
            {
                "destination": "slack",
                "idempotency_key": f"final-escalation:slack:{incident_id}",
                "payload": payload,
            },
            {
                "destination": "github_issue",
                "idempotency_key": f"final-escalation:github:{incident_id}",
                "payload": payload,
            },
        ],
        escalate=True,
    )
