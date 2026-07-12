"""DB-authoritative ops.slack_events operations (I6 / docs/incident-agent.md §7-8, §11)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Literal
from uuid import UUID

from app.db import Database, parse_vector
from app.keys import sha256_hex

MAX_SLACK_EVENT_ATTEMPTS = 3

RegisterOutcome = Literal["registered", "retry_enqueue", "duplicate", "rate_limited"]
ClaimOutcome = Literal[
    "claimed",
    "busy",
    "completed",
    "failed",
    "exhausted",
    "missing",
    "incident_busy",
]


@dataclass(frozen=True)
class SlackEventRequest:
    event_id: str
    task_name: str
    team_id: str
    channel_id: str
    thread_ts: str
    user_id: str


@dataclass(frozen=True)
class SlackEventRow:
    event_id: str
    task_name: str
    incident_id: UUID | None
    team_id: str
    channel_id: str
    thread_ts: str
    user_id: str
    status: str
    attempt_count: int


@dataclass(frozen=True)
class FollowupIncident:
    id: UUID
    status: str
    resource: str
    alert_policy: str
    rca_hypothesis: str | None
    github_issue: str | None
    embedding: list[float] | None
    issue_outbox_id: UUID | None


def slack_rate_lock_key(team_id: str, channel_id: str, user_id: str) -> int:
    digest = sha256_hex(f"slack:{team_id}:{channel_id}:{user_id}")
    return int(digest[:16], 16) & 0x7FFFFFFFFFFFFFFF


def incident_followup_lock_key(incident_id: UUID) -> int:
    digest = sha256_hex(f"slack-followup:{incident_id}")
    return int(digest[:16], 16) & 0x7FFFFFFFFFFFFFFF


def register_slack_event(
    db: Database,
    *,
    request: SlackEventRequest,
    rate_limit_per_minute: int,
) -> RegisterOutcome:
    """§7-8: serialize the recent-count check and INSERT under one advisory lock."""
    with db.transaction() as conn:
        conn.execute(
            "SELECT pg_advisory_xact_lock(%s)",
            (
                slack_rate_lock_key(
                    request.team_id, request.channel_id, request.user_id
                ),
            ),
        )
        existing = conn.execute(
            "SELECT status FROM ops.slack_events WHERE event_id = %s",
            (request.event_id,),
        ).fetchone()
        if existing:
            return "retry_enqueue" if existing["status"] == "pending" else "duplicate"

        if rate_limit_per_minute <= 0:
            return "rate_limited"
        recent = conn.execute(
            """
            SELECT count(*) AS recent
              FROM ops.slack_events
             WHERE team_id = %s
               AND channel_id = %s
               AND user_id = %s
               AND received_at >= now() - interval '60 seconds'
            """,
            (request.team_id, request.channel_id, request.user_id),
        ).fetchone()
        if recent and recent["recent"] >= rate_limit_per_minute:
            return "rate_limited"

        conn.execute(
            """
            INSERT INTO ops.slack_events (
                event_id, task_name, team_id, channel_id, thread_ts, user_id
            ) VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                request.event_id,
                request.task_name,
                request.team_id,
                request.channel_id,
                request.thread_ts,
                request.user_id,
            ),
        )
    return "registered"


def load_slack_event(db: Database, event_id: str) -> SlackEventRow | None:
    with db.connection() as conn:
        row = conn.execute(
            "SELECT * FROM ops.slack_events WHERE event_id = %s",
            (event_id,),
        ).fetchone()
    if not row:
        return None
    return _row_to_event(row)


def claim_slack_event(
    db: Database,
    *,
    event_id: str,
    lease_seconds: int,
    incident_id: UUID | None,
) -> tuple[ClaimOutcome, SlackEventRow | None]:
    """Claim one event with lease + max-3 attempts and per-incident exclusivity (§11)."""
    if lease_seconds <= 0:
        raise ValueError("lease_seconds must be positive")
    with db.transaction() as conn:
        if incident_id is not None:
            # FOR UPDATE only locks this event's row; two tasks for different
            # events on the same incident would otherwise both pass the
            # exclusivity SELECT below. The advisory lock serializes claims
            # per incident so §11's one-follow-up-at-a-time holds.
            conn.execute(
                "SELECT pg_advisory_xact_lock(%s)",
                (incident_followup_lock_key(incident_id),),
            )
        row = conn.execute(
            "SELECT * FROM ops.slack_events WHERE event_id = %s FOR UPDATE",
            (event_id,),
        ).fetchone()
        if not row:
            return ("missing", None)
        if row["status"] == "completed":
            return ("completed", None)
        if row["status"] == "failed":
            return ("failed", None)
        if row["status"] == "processing" and row["lease_expires_at"] is not None:
            active = conn.execute(
                "SELECT %s > now() AS active",
                (row["lease_expires_at"],),
            ).fetchone()
            if active and active["active"]:
                return ("busy", None)
        if row["attempt_count"] >= MAX_SLACK_EVENT_ATTEMPTS:
            conn.execute(
                """
                UPDATE ops.slack_events
                   SET status = 'failed', lease_expires_at = NULL
                 WHERE event_id = %s
                """,
                (event_id,),
            )
            # "exhausted" marks the transition to failed (vs. already failed)
            # so the caller can notify the thread exactly once.
            return ("exhausted", _row_to_event(row))

        if incident_id is not None:
            other = conn.execute(
                """
                SELECT 1
                  FROM ops.slack_events
                 WHERE incident_id = %s
                   AND event_id <> %s
                   AND status = 'processing'
                   AND lease_expires_at IS NOT NULL
                   AND lease_expires_at > now()
                 LIMIT 1
                """,
                (incident_id, event_id),
            ).fetchone()
            if other:
                return ("incident_busy", None)

        claimed = conn.execute(
            """
            UPDATE ops.slack_events
               SET status = 'processing',
                   attempt_count = attempt_count + 1,
                   lease_expires_at = now() + %s,
                   incident_id = COALESCE(%s, incident_id)
             WHERE event_id = %s
             RETURNING *
            """,
            (timedelta(seconds=lease_seconds), incident_id, event_id),
        ).fetchone()
        assert claimed is not None
        return ("claimed", _row_to_event(claimed))


def complete_slack_event(db: Database, *, event_id: str) -> bool:
    with db.transaction() as conn:
        row = conn.execute(
            """
            UPDATE ops.slack_events
               SET status = 'completed',
                   completed_at = now(),
                   lease_expires_at = NULL
             WHERE event_id = %s
               AND status = 'processing'
             RETURNING event_id
            """,
            (event_id,),
        ).fetchone()
    return row is not None


def release_slack_event(db: Database, *, event_id: str) -> str:
    """Release a failed attempt; permanently fail after the third try."""
    with db.transaction() as conn:
        row = conn.execute(
            """
            UPDATE ops.slack_events
               SET status = CASE
                     WHEN attempt_count >= %s THEN 'failed'
                     ELSE 'pending'
                   END,
                   lease_expires_at = NULL
             WHERE event_id = %s
               AND status = 'processing'
             RETURNING status
            """,
            (MAX_SLACK_EVENT_ATTEMPTS, event_id),
        ).fetchone()
    return row["status"] if row else "stale"


def count_thread_events_last_hour(
    db: Database,
    *,
    team_id: str,
    channel_id: str,
    thread_ts: str,
    user_id: str,
) -> int:
    with db.connection() as conn:
        row = conn.execute(
            """
            SELECT count(*) AS recent
              FROM ops.slack_events
             WHERE team_id = %s
               AND channel_id = %s
               AND thread_ts = %s
               AND user_id = %s
               AND status <> 'failed'
               AND received_at >= now() - interval '1 hour'
            """,
            (team_id, channel_id, thread_ts, user_id),
        ).fetchone()
    return int(row["recent"]) if row else 0


def lookup_incident_for_thread(
    db: Database,
    *,
    team_id: str,
    channel_id: str,
    thread_ts: str,
) -> FollowupIncident | None:
    """§11: only known, unresolved, issue-linked threads are eligible."""
    with db.connection() as conn:
        row = conn.execute(
            """
            SELECT i.id, i.status, i.resource, i.alert_policy,
                   i.rca_hypothesis, i.github_issue, i.embedding,
                   (
                     SELECT o.id
                       FROM ops.outbox o
                      WHERE o.incident_id = i.id
                        AND o.destination = 'github_issue'
                      ORDER BY o.created_at ASC, o.id ASC
                      LIMIT 1
                   ) AS issue_outbox_id
              FROM ops.incidents i
             WHERE i.slack_team = %s
               AND i.slack_channel = %s
               AND i.slack_thread = %s
               AND i.resolved_at IS NULL
               AND i.status <> 'merged'
            """,
            (team_id, channel_id, thread_ts),
        ).fetchone()
    if not row:
        return None
    return FollowupIncident(
        id=row["id"],
        status=row["status"],
        resource=row["resource"],
        alert_policy=row["alert_policy"],
        rca_hypothesis=row["rca_hypothesis"],
        github_issue=row["github_issue"],
        embedding=parse_vector(row["embedding"]),
        issue_outbox_id=row["issue_outbox_id"],
    )


def reserve_followup_budget(db: Database, *, event_id: str, max_budget: int) -> bool:
    """§7-4: the worker shares ops.budget_usage with ingest.

    Charges at most one investigation slot per Slack event: retries of the
    same event (transient LLM/DB failures, lease expiry) reuse the original
    reservation instead of draining the shared daily budget.
    """
    with db.transaction() as conn:
        row = conn.execute(
            """
            SELECT budget_reserved FROM ops.slack_events
             WHERE event_id = %s
             FOR UPDATE
            """,
            (event_id,),
        ).fetchone()
        if row is None:
            return False
        if row["budget_reserved"]:
            return True
        reserved = conn.execute(
            "SELECT ops.reserve_investigation_budget(%s) AS reserved",
            (max_budget,),
        ).fetchone()
        if not (reserved and reserved["reserved"]):
            return False
        conn.execute(
            "UPDATE ops.slack_events SET budget_reserved = true WHERE event_id = %s",
            (event_id,),
        )
    return True


class _StaleEventError(Exception):
    """Another invocation already finished this event; roll the comment back."""


def save_followup_comment_and_complete(
    db: Database,
    *,
    event_id: str,
    incident_id: UUID,
    issue_outbox_id: UUID,
    payload: dict[str, Any],
) -> bool:
    """Persist the issue-comment outbox and event completion atomically (§11)."""
    try:
        with db.transaction() as conn:
            conn.execute(
                """
                INSERT INTO ops.outbox (
                    incident_id, destination, idempotency_key, payload, depends_on
                ) VALUES (%s, 'github_comment', %s, %s::jsonb, %s)
                ON CONFLICT (idempotency_key) DO NOTHING
                """,
                (
                    incident_id,
                    f"slack-followup:{event_id}",
                    json.dumps(payload),
                    issue_outbox_id,
                ),
            )
            row = conn.execute(
                """
                UPDATE ops.slack_events
                   SET status = 'completed',
                       completed_at = now(),
                       lease_expires_at = NULL
                 WHERE event_id = %s
                   AND status = 'processing'
                 RETURNING event_id
                """,
                (event_id,),
            ).fetchone()
            if not row:
                raise _StaleEventError()
    except _StaleEventError:
        return False
    return True


def delete_expired_slack_events(db: Database, *, retention_days: int) -> int:
    """§11: purge completed/failed rows older than the retention window."""
    if retention_days <= 0:
        raise ValueError("retention_days must be positive")
    with db.transaction() as conn:
        rows = conn.execute(
            """
            DELETE FROM ops.slack_events
             WHERE status IN ('completed', 'failed')
               AND COALESCE(completed_at, received_at) < now() - %s
             RETURNING event_id
            """,
            (timedelta(days=retention_days),),
        ).fetchall()
    return len(rows)


def list_session_cleanup_incidents(
    db: Database,
    *,
    retention_days: int,
) -> list[UUID]:
    """All incidents past the session TTL; deletion is idempotent so re-scans are cheap."""
    if retention_days <= 0:
        raise ValueError("retention_days must be positive")
    with db.connection() as conn:
        rows = conn.execute(
            """
            SELECT id FROM ops.incidents
             WHERE resolved_at IS NOT NULL
               AND resolved_at < now() - %s
             ORDER BY resolved_at ASC
            """,
            (timedelta(days=retention_days),),
        ).fetchall()
    return [row["id"] for row in rows]


def _row_to_event(row: dict[str, Any]) -> SlackEventRow:
    return SlackEventRow(
        event_id=row["event_id"],
        task_name=row["task_name"],
        incident_id=row["incident_id"],
        team_id=row["team_id"],
        channel_id=row["channel_id"],
        thread_ts=row["thread_ts"],
        user_id=row["user_id"],
        status=row["status"],
        attempt_count=row["attempt_count"],
    )
