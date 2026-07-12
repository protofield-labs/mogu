from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
import json
from typing import Any, Literal
from uuid import UUID, uuid4

from app.db import Database
from app.telemetry import record_issue_opened

MAX_OUTBOX_ATTEMPTS = 10
OutboxState = Literal["claimed", "busy", "sent", "failed", "missing", "blocked"]


@dataclass(frozen=True)
class OutboxRecord:
    id: UUID
    incident_id: UUID
    destination: str
    idempotency_key: str
    depends_on: UUID | None
    dependency_external_ref: str | None
    dispatch_generation: int
    payload: dict[str, Any]
    attempt_count: int
    delivery_token: UUID
    incident_status: str
    incident_kind: str
    resource: str
    alert_policy: str
    severity: str | None
    github_issue: str | None


@dataclass(frozen=True)
class ClaimResult:
    state: OutboxState
    record: OutboxRecord | None = None


def list_dispatchable_outbox(
    db: Database,
    *,
    limit: int = 100,
) -> list[tuple[UUID, int]]:
    """Read pending or expired-lease rows whose dependency is already sent."""
    if not 1 <= limit <= 1000:
        raise ValueError("limit must be between 1 and 1000")
    with db.connection() as conn:
        rows = conn.execute(
            """
            SELECT o.id,
                   CASE
                     WHEN o.status = 'sending'
                       THEN o.dispatch_generation + o.attempt_count
                     ELSE o.dispatch_generation
                   END AS task_generation
              FROM ops.outbox o
              LEFT JOIN ops.outbox dependency ON dependency.id = o.depends_on
             WHERE (
                   o.status = 'pending'
                   OR (
                     o.status = 'sending'
                     AND o.lease_expires_at IS NOT NULL
                     AND o.lease_expires_at <= now()
                   )
               )
               AND (o.depends_on IS NULL OR dependency.status = 'sent')
             ORDER BY o.created_at ASC, o.id ASC
             LIMIT %s
            """,
            (limit,),
        ).fetchall()
    return [(row["id"], row["task_generation"]) for row in rows]


def claim_outbox(
    db: Database,
    *,
    outbox_id: UUID,
    lease_seconds: int,
) -> ClaimResult:
    """Claim one DB-authoritative outbox row with a stale-worker token."""
    if lease_seconds <= 0:
        raise ValueError("lease_seconds must be positive")
    with db.transaction() as conn:
        row = conn.execute(
            """
            SELECT o.*, i.status AS incident_status,
                   i.incident_kind, i.resource, i.alert_policy, i.severity,
                   i.github_issue,
                   dependency.status AS dependency_status,
                   dependency.external_ref AS dependency_external_ref
              FROM ops.outbox o
              JOIN ops.incidents i ON i.id = o.incident_id
              LEFT JOIN ops.outbox dependency ON dependency.id = o.depends_on
             WHERE o.id = %s
             FOR UPDATE OF o
            """,
            (outbox_id,),
        ).fetchone()
        if not row:
            return ClaimResult("missing")
        if row["status"] == "sent":
            return ClaimResult("sent")
        if row["status"] == "failed":
            return ClaimResult("failed")
        if row["depends_on"] is not None and row["dependency_status"] != "sent":
            return ClaimResult("blocked")
        if row["status"] == "sending" and row["lease_expires_at"] is not None:
            active = conn.execute(
                "SELECT %s > now() AS active",
                (row["lease_expires_at"],),
            ).fetchone()
            if active and active["active"]:
                return ClaimResult("busy")
        if row["attempt_count"] >= MAX_OUTBOX_ATTEMPTS:
            conn.execute(
                """
                UPDATE ops.outbox
                   SET status = 'failed', lease_expires_at = NULL
                 WHERE id = %s
                """,
                (outbox_id,),
            )
            return ClaimResult("failed")

        token = uuid4()
        claimed = conn.execute(
            """
            UPDATE ops.outbox
               SET status = 'sending',
                   attempt_count = attempt_count + 1,
                   lease_expires_at = now() + %s,
                   delivery_token = %s
             WHERE id = %s
             RETURNING attempt_count
            """,
            (timedelta(seconds=lease_seconds), token, outbox_id),
        ).fetchone()
        assert claimed is not None
        payload = row["payload"]
        if not isinstance(payload, dict):
            # JSONB should be an object by contract; fail this row permanently.
            conn.execute(
                """
                UPDATE ops.outbox
                   SET status = 'failed', lease_expires_at = NULL
                 WHERE id = %s AND delivery_token = %s
                """,
                (outbox_id, token),
            )
            return ClaimResult("failed")
        return ClaimResult(
            "claimed",
            OutboxRecord(
                id=row["id"],
                incident_id=row["incident_id"],
                destination=row["destination"],
                idempotency_key=row["idempotency_key"],
                depends_on=row["depends_on"],
                dependency_external_ref=row["dependency_external_ref"],
                dispatch_generation=row["dispatch_generation"],
                payload=payload,
                attempt_count=claimed["attempt_count"],
                delivery_token=token,
                incident_status=row["incident_status"],
                incident_kind=row["incident_kind"],
                resource=row["resource"],
                alert_policy=row["alert_policy"],
                severity=row["severity"],
                github_issue=row["github_issue"],
            ),
        )


class ReferenceConflictError(RuntimeError):
    """Incident already carries a different external reference.

    The external side effect has already happened, but retrying the task
    cannot resolve the mismatch; it requires operator replay after fixing
    the incident row.
    """


def mark_outbox_sent(
    db: Database,
    *,
    record: OutboxRecord,
    external_ref: str,
    slack_team: str | None = None,
    slack_channel: str | None = None,
    slack_thread: str | None = None,
) -> bool:
    """Commit delivery and incident references only for the current lease token."""
    with db.transaction() as conn:
        sent = conn.execute(
            """
            UPDATE ops.outbox
               SET status = 'sent',
                   external_ref = %s,
                   sent_at = now(),
                   lease_expires_at = NULL
             WHERE id = %s
               AND status = 'sending'
               AND delivery_token = %s
             RETURNING incident_id
            """,
            (external_ref, record.id, record.delivery_token),
        ).fetchone()
        if not sent:
            return False
        if record.destination == "github_issue":
            updated = conn.execute(
                """
                UPDATE ops.incidents
                   SET github_issue = %s
                 WHERE id = %s
                   AND (github_issue IS NULL OR github_issue = %s)
                 RETURNING id
                """,
                (external_ref, record.incident_id, external_ref),
            ).fetchone()
            if not updated:
                raise ReferenceConflictError("incident GitHub reference conflict")
            record_issue_opened()
            if record.payload.get("kind") == "primary_investigation":
                slack_outbox = conn.execute(
                    """
                    SELECT id
                      FROM ops.outbox
                     WHERE incident_id = %s
                       AND destination = 'slack'
                       AND idempotency_key = %s
                    """,
                    (
                        record.incident_id,
                        f"primary-slack:{record.incident_id}",
                    ),
                ).fetchone()
                if slack_outbox:
                    update_payload = {**record.payload, "operation": "update"}
                    conn.execute(
                        """
                        INSERT INTO ops.outbox (
                            incident_id, destination, idempotency_key,
                            payload, depends_on
                        )
                        VALUES (%s, 'slack', %s, %s::jsonb, %s)
                        ON CONFLICT (idempotency_key) DO NOTHING
                        """,
                        (
                            record.incident_id,
                            f"primary-slack-issue-update:{record.incident_id}",
                            json.dumps(update_payload),
                            slack_outbox["id"],
                        ),
                    )
        elif record.destination == "slack":
            if not slack_team or not slack_channel or not slack_thread:
                raise ReferenceConflictError("complete Slack reference is required")
            updated = conn.execute(
                """
                UPDATE ops.incidents
                   SET slack_team = %s,
                       slack_channel = %s,
                       slack_thread = %s
                 WHERE id = %s
                   AND (
                     (slack_team IS NULL AND slack_channel IS NULL AND slack_thread IS NULL)
                     OR (slack_team = %s AND slack_channel = %s AND slack_thread = %s)
                   )
                 RETURNING id
                """,
                (
                    slack_team,
                    slack_channel,
                    slack_thread,
                    record.incident_id,
                    slack_team,
                    slack_channel,
                    slack_thread,
                ),
            ).fetchone()
            if not updated:
                raise ReferenceConflictError("incident Slack reference conflict")
    return True


def release_or_fail_outbox(db: Database, *, record: OutboxRecord) -> str:
    """Release a failed attempt, permanently failing after the tenth try."""
    with db.transaction() as conn:
        row = conn.execute(
            """
            UPDATE ops.outbox
               SET status = CASE
                     WHEN attempt_count >= %s THEN 'failed'
                     ELSE 'pending'
                   END,
                   lease_expires_at = NULL
             WHERE id = %s
               AND status = 'sending'
               AND delivery_token = %s
             RETURNING status
            """,
            (MAX_OUTBOX_ATTEMPTS, record.id, record.delivery_token),
        ).fetchone()
    return row["status"] if row else "stale"


def fail_outbox_safety(db: Database, *, record: OutboxRecord) -> bool:
    """Permanently fail unsafe output without retrying the same payload."""
    with db.transaction() as conn:
        row = conn.execute(
            """
            UPDATE ops.outbox
               SET status = 'failed', lease_expires_at = NULL
             WHERE id = %s
               AND status = 'sending'
               AND delivery_token = %s
             RETURNING id
            """,
            (record.id, record.delivery_token),
        ).fetchone()
    return row is not None


def replay_failed_outbox(db: Database, outbox_id: UUID) -> bool:
    """CAS replay without mutating payload, key, destination, or dependency."""
    with db.transaction() as conn:
        row = conn.execute(
            """
            UPDATE ops.outbox
               SET status = 'pending',
                   attempt_count = 0,
                   lease_expires_at = NULL,
                   dispatch_generation = dispatch_generation + 1,
                   delivery_token = gen_random_uuid()
             WHERE id = %s
               AND status = 'failed'
             RETURNING id
            """,
            (outbox_id,),
        ).fetchone()
    return row is not None


def review_incident(
    db: Database,
    *,
    incident_id: UUID,
    rca_summary: str,
    reviewer_id: str,
) -> bool:
    if not rca_summary.strip() or len(rca_summary) > 10_000:
        raise ValueError("RCA summary must be 1..10000 characters")
    if not reviewer_id.strip() or len(reviewer_id) > 255:
        raise ValueError("reviewer ID must be 1..255 characters")
    with db.transaction() as conn:
        row = conn.execute(
            """
            UPDATE ops.incidents
               SET status = 'resolved',
                   resolved_at = now(),
                   rca_hypothesis = %s,
                   rca_reviewed = true,
                   reviewed_at = now(),
                   reviewed_by = %s,
                   investigation_token = gen_random_uuid(),
                   lease_expires_at = now()
             WHERE id = %s
               AND status IN ('analyzed', 'escalated')
               AND resolved_at IS NULL
             RETURNING id
            """,
            (rca_summary.strip(), reviewer_id.strip(), incident_id),
        ).fetchone()
    return row is not None
