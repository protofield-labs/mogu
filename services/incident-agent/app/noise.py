from __future__ import annotations

from contextlib import ExitStack
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

import psycopg

from app.config import Settings
from app.db import (
    Database,
    parse_vector,
    reserve_embedding_budget,
    reserve_investigation_budget,
    resource_advisory_lock,
    storm_advisory_lock,
    vector_to_pg,
)
from app.deadline import RequestDeadline, lease_expires_at, new_token
from app.embedding import EmbeddingClient
from app.keys import compute_incident_key, compute_storm_key
from app.owner import create_storm_merge_outboxes
from app.telemetry import record_incident_opened


@dataclass(frozen=True)
class InvestigationReady:
    """Hook for I3 LoopAgent — owner acquired, ready for investigation."""

    incident_id: UUID
    delivery_message_id: str
    investigation_token: UUID
    work_token: UUID
    alert: dict[str, Any]
    embedding: list[float]
    playbook_hint: str | None
    loop_budget_seconds: float


@dataclass(frozen=True)
class IngestResult:
    status_code: int
    body: dict[str, Any]


@dataclass
class DeliveryRow:
    message_id: str
    resource: str
    alert_policy: str
    incident_key: str
    sanitized_alert: dict[str, Any]
    incident_id: UUID | None
    is_owner: bool
    status: str
    work_token: UUID
    work_lease_expires_at: datetime | None
    embedding_reserved: bool
    embedding_attempt_count: int
    embedding: list[float] | None


@dataclass
class IncidentRow:
    id: UUID
    incident_key: str
    incident_kind: str
    storm_key: str | None
    alert_policy: str
    resource: str
    status: str
    alert_count: int
    last_seen_at: datetime
    investigation_token: UUID
    lease_expires_at: datetime
    attempt_count: int
    embedding: list[float] | None
    embedding_unavailable: bool
    github_issue: str | None


FIXED_ESCALATION_OUTBOX = {
    "text": (
        "Incident agent could not complete automated investigation. "
        "Manual review required."
    )
}


def _row_to_delivery(row: dict[str, Any]) -> DeliveryRow:
    return DeliveryRow(
        message_id=row["message_id"],
        resource=row["resource"],
        alert_policy=row["alert_policy"],
        incident_key=row["incident_key"],
        sanitized_alert=row["sanitized_alert"],
        incident_id=row.get("incident_id"),
        is_owner=row["is_owner"],
        status=row["status"],
        work_token=row["work_token"],
        work_lease_expires_at=row.get("work_lease_expires_at"),
        embedding_reserved=row["embedding_reserved"],
        embedding_attempt_count=row["embedding_attempt_count"],
        embedding=parse_vector(row.get("embedding")),
    )


def _row_to_incident(row: dict[str, Any]) -> IncidentRow:
    return IncidentRow(
        id=row["id"],
        incident_key=row["incident_key"],
        incident_kind=row["incident_kind"],
        storm_key=row.get("storm_key"),
        alert_policy=row["alert_policy"],
        resource=row["resource"],
        status=row["status"],
        alert_count=row["alert_count"],
        last_seen_at=row["last_seen_at"],
        investigation_token=row["investigation_token"],
        lease_expires_at=row["lease_expires_at"],
        attempt_count=row["attempt_count"],
        embedding=parse_vector(row.get("embedding")),
        embedding_unavailable=row["embedding_unavailable"],
        github_issue=row.get("github_issue"),
    )


def search_open_similar_incidents(
    conn: psycopg.Connection[Any],
    *,
    resource: str,
    alert_policy: str,
    embedding: list[float],
    threshold: float,
) -> IncidentRow | None:
    """L4: pgvector cosine similarity on open incidents (§5, §9)."""
    vec = vector_to_pg(embedding)
    row = conn.execute(
        """
        SELECT i.*
          FROM ops.incidents i
         WHERE i.resource = %s
           AND i.alert_policy = %s
           AND i.resolved_at IS NULL
           AND i.status <> 'merged'
           AND i.embedding IS NOT NULL
         ORDER BY i.embedding <=> %s::vector ASC,
                  i.last_seen_at DESC,
                  i.id ASC
         LIMIT 1
        """,
        (resource, alert_policy, vec),
    ).fetchone()
    if not row:
        return None
    incident = _row_to_incident(row)
    if incident.embedding is None:
        return None
    from app.embedding import cosine_similarity

    sim = cosine_similarity(embedding, incident.embedding)
    if sim >= threshold:
        return incident
    return None


def count_recent_deliveries(
    conn: psycopg.Connection[Any],
    *,
    resource: str,
    alert_policy: str,
    window_seconds: int,
) -> int:
    row = conn.execute(
        """
        SELECT COUNT(*) AS cnt
          FROM ops.alert_deliveries
         WHERE resource = %s
           AND alert_policy = %s
           AND received_at >= now() - make_interval(secs => %s)
        """,
        (resource, alert_policy, window_seconds),
    ).fetchone()
    return int(row["cnt"]) if row else 0


def find_open_storm(
    conn: psycopg.Connection[Any], resource: str, alert_policy: str
) -> IncidentRow | None:
    row = conn.execute(
        """
        SELECT * FROM ops.incidents
         WHERE resource = %s
           AND alert_policy = %s
           AND incident_kind = 'storm'
           AND resolved_at IS NULL
           AND status <> 'merged'
         LIMIT 1
        """,
        (resource, alert_policy),
    ).fetchone()
    return _row_to_incident(row) if row else None


def find_l1_match(
    conn: psycopg.Connection[Any], incident_key: str
) -> IncidentRow | None:
    row = conn.execute(
        """
        SELECT * FROM ops.incidents
         WHERE incident_key = %s
           AND resolved_at IS NULL
           AND status <> 'merged'
         LIMIT 1
        """,
        (incident_key,),
    ).fetchone()
    return _row_to_incident(row) if row else None


def find_l2_candidate(
    conn: psycopg.Connection[Any],
    *,
    resource: str,
    alert_policy: str,
    window_seconds: int,
) -> IncidentRow | None:
    row = conn.execute(
        """
        SELECT * FROM ops.incidents
         WHERE resource = %s
           AND alert_policy = %s
           AND resolved_at IS NULL
           AND status <> 'merged'
           AND incident_kind = 'normal'
           AND last_seen_at >= now() - make_interval(secs => %s)
         ORDER BY last_seen_at DESC, created_at DESC, id ASC
         LIMIT 1
        """,
        (resource, alert_policy, window_seconds),
    ).fetchone()
    return _row_to_incident(row) if row else None


def aggregate_to_incident(
    conn: psycopg.Connection[Any],
    *,
    incident: IncidentRow,
    message_id: str,
    delivery: DeliveryRow,
) -> None:
    """Step 7: common aggregation — update count/last_seen, outbox for analyzed/escalated."""
    conn.execute(
        """
        UPDATE ops.incidents
           SET alert_count = alert_count + 1,
               last_seen_at = now()
         WHERE id = %s
        """,
        (incident.id,),
    )

    if incident.status in ("analyzed", "escalated"):
        idempotency_key = f"github_comment:{incident.id}:{message_id}"
        conn.execute(
            """
            INSERT INTO ops.outbox (incident_id, destination, idempotency_key, payload, depends_on)
            SELECT %s, 'github_comment', %s, %s::jsonb,
                   (SELECT id FROM ops.outbox
                     WHERE incident_id = %s AND destination = 'github_issue'
                     ORDER BY created_at ASC LIMIT 1)
            ON CONFLICT (idempotency_key) DO NOTHING
            """,
            (
                incident.id,
                idempotency_key,
                json.dumps({"message_id": message_id, "alert": delivery.sanitized_alert}),
                incident.id,
            ),
        )

    conn.execute(
        """
        UPDATE ops.alert_deliveries
           SET status = 'completed',
               is_owner = false,
               completed_at = now(),
               incident_id = %s,
               work_token = gen_random_uuid(),
               work_lease_expires_at = NULL
         WHERE message_id = %s
        """,
        (incident.id, delivery.message_id),
    )


def lock_claimable_delivery(
    conn: psycopg.Connection[Any], message_id: str
) -> DeliveryRow | IngestResult:
    row = conn.execute(
        "SELECT * FROM ops.alert_deliveries WHERE message_id = %s FOR UPDATE",
        (message_id,),
    ).fetchone()
    if not row:
        return IngestResult(500, {"error": "delivery missing"})
    delivery = _row_to_delivery(row)
    if delivery.status == "completed":
        return IngestResult(200, {"action": "already_completed"})
    if delivery.status != "received":
        return IngestResult(503, {"error": "delivery is not claimable"})
    return delivery


def merge_normals_into_storm(
    conn: psycopg.Connection[Any],
    *,
    storm_id: UUID,
    resource: str,
    alert_policy: str,
    new_token: UUID,
) -> None:
    """Storm merge: normals → merged, owner deliveries → completed (§9 step 3)."""
    conn.execute(
        """
        UPDATE ops.incidents
           SET status = 'merged',
               merged_into = %s,
               investigation_token = %s,
               lease_expires_at = now()
         WHERE resource = %s
           AND alert_policy = %s
           AND incident_kind = 'normal'
           AND resolved_at IS NULL
           AND status NOT IN ('merged', 'resolved')
        """,
        (storm_id, new_token, resource, alert_policy),
    )

    conn.execute(
        """
        UPDATE ops.alert_deliveries d
           SET status = 'completed',
               is_owner = false,
               completed_at = now(),
               work_token = %s,
               work_lease_expires_at = NULL
          FROM ops.incidents i
         WHERE d.incident_id = i.id
           AND i.merged_into = %s
           AND d.status = 'processing'
           AND d.is_owner = true
        """,
        (new_token, storm_id),
    )


class NoiseOrchestrator:
    def __init__(
        self,
        db: Database,
        settings: Settings,
        embedding_client: EmbeddingClient,
    ):
        self._db = db
        self._settings = settings
        self._embedding = embedding_client

    def resume_embedding(
        self,
        delivery: DeliveryRow,
        alert: dict[str, Any],
        deadline: RequestDeadline,
    ) -> IngestResult | InvestigationReady:
        """Resume an expired embedding lease without losing the L3 storm branch."""
        storm_key: str | None = None
        with self._db.transaction() as conn:
            with resource_advisory_lock(conn, delivery.resource, delivery.alert_policy):
                row = conn.execute(
                    "SELECT * FROM ops.alert_deliveries WHERE message_id = %s FOR UPDATE",
                    (delivery.message_id,),
                ).fetchone()
                if not row:
                    return IngestResult(500, {"error": "delivery missing"})
                current = _row_to_delivery(row)
                if current.status == "completed":
                    return IngestResult(200, {"action": "already_completed"})
                if current.status != "embedding":
                    return IngestResult(503, {"error": "embedding state advanced"})
                delivery = current

                storm = find_open_storm(
                    conn, delivery.resource, delivery.alert_policy
                )
                if storm:
                    aggregate_to_incident(
                        conn,
                        incident=storm,
                        message_id=delivery.message_id,
                        delivery=delivery,
                    )
                    return IngestResult(
                        200,
                        {
                            "action": "aggregated_storm_resume",
                            "incident_id": str(storm.id),
                        },
                    )

                rate = count_recent_deliveries(
                    conn,
                    resource=delivery.resource,
                    alert_policy=delivery.alert_policy,
                    window_seconds=self._settings.l3_storm_window_seconds,
                )
                if rate > self._settings.l3_storm_threshold:
                    storm_key = compute_storm_key(
                        alert_policy=delivery.alert_policy,
                        resource=delivery.resource,
                    )

        embedding = self._ensure_embedding(
            delivery, alert, deadline, storm_key=storm_key
        )
        if isinstance(embedding, IngestResult):
            return embedding
        if storm_key:
            return self._handle_storm_branch(delivery, alert, deadline)
        return self._post_embedding_phase(delivery, alert, embedding, deadline)

    def run_after_masking(
        self,
        delivery: DeliveryRow,
        alert: dict[str, Any],
        deadline: RequestDeadline,
    ) -> IngestResult | InvestigationReady:
        """Execute noise control steps 2-5 after masking checkpoint."""
        deadline.ensure_not_expired()

        # Phase 1: pre-embedding (steps 2-3)
        with self._db.transaction() as conn:
            with resource_advisory_lock(conn, delivery.resource, delivery.alert_policy):
                current = lock_claimable_delivery(conn, delivery.message_id)
                if isinstance(current, IngestResult):
                    return current
                delivery = current
                storm = find_open_storm(conn, delivery.resource, delivery.alert_policy)
                if storm:
                    aggregate_to_incident(
                        conn, incident=storm, message_id=delivery.message_id, delivery=delivery
                    )
                    return IngestResult(200, {"action": "aggregated_storm", "incident_id": str(storm.id)})

                l1 = find_l1_match(conn, delivery.incident_key)
                l2 = find_l2_candidate(
                    conn,
                    resource=delivery.resource,
                    alert_policy=delivery.alert_policy,
                    window_seconds=self._settings.l2_grouping_window_seconds,
                )

                rate = count_recent_deliveries(
                    conn,
                    resource=delivery.resource,
                    alert_policy=delivery.alert_policy,
                    window_seconds=self._settings.l3_storm_window_seconds,
                )
                l3_hit = rate > self._settings.l3_storm_threshold

                if l3_hit:
                    pass  # proceed to storm branch outside lock
                elif l1:
                    aggregate_to_incident(
                        conn, incident=l1, message_id=delivery.message_id, delivery=delivery
                    )
                    return IngestResult(200, {"action": "aggregated_l1", "incident_id": str(l1.id)})
                elif l2:
                    aggregate_to_incident(
                        conn, incident=l2, message_id=delivery.message_id, delivery=delivery
                    )
                    return IngestResult(200, {"action": "aggregated_l2", "incident_id": str(l2.id)})

        if l3_hit:
            return self._handle_storm_branch(delivery, alert, deadline)

        # Phase 1 miss → embedding (step 4)
        embedding = self._ensure_embedding(delivery, alert, deadline)
        if isinstance(embedding, IngestResult):
            return embedding

        # Phase 2: post-embedding (step 5)
        return self._post_embedding_phase(delivery, alert, embedding, deadline)

    def _handle_storm_branch(
        self,
        delivery: DeliveryRow,
        alert: dict[str, Any],
        deadline: RequestDeadline,
    ) -> IngestResult | InvestigationReady:
        deadline.ensure_not_expired()
        storm_key = compute_storm_key(
            alert_policy=delivery.alert_policy, resource=delivery.resource
        )

        with self._db.transaction() as conn:
            with resource_advisory_lock(conn, delivery.resource, delivery.alert_policy):
                with storm_advisory_lock(conn, storm_key):
                    current = lock_claimable_delivery(conn, delivery.message_id)
                    if isinstance(current, IngestResult):
                        return current
                    delivery = current
                    existing = conn.execute(
                        """
                        SELECT * FROM ops.incidents
                         WHERE storm_key = %s
                           AND resolved_at IS NULL
                           AND status <> 'merged'
                         LIMIT 1
                        """,
                        (storm_key,),
                    ).fetchone()
                    if existing:
                        incident = _row_to_incident(existing)
                        aggregate_to_incident(
                            conn,
                            incident=incident,
                            message_id=delivery.message_id,
                            delivery=delivery,
                        )
                        return IngestResult(
                            200,
                            {
                                "action": "aggregated_storm_key",
                                "incident_id": str(incident.id),
                            },
                        )

        embedding = self._ensure_embedding(
            delivery, alert, deadline, storm_key=storm_key
        )
        if isinstance(embedding, IngestResult):
            return embedding

        with self._db.transaction() as conn:
            with resource_advisory_lock(conn, delivery.resource, delivery.alert_policy):
                with storm_advisory_lock(conn, storm_key):
                    current = lock_claimable_delivery(conn, delivery.message_id)
                    if isinstance(current, IngestResult):
                        return current
                    delivery = current
                    existing = conn.execute(
                        """
                        SELECT * FROM ops.incidents
                         WHERE storm_key = %s
                           AND resolved_at IS NULL
                           AND status <> 'merged'
                         LIMIT 1
                        """,
                        (storm_key,),
                    ).fetchone()
                    if existing:
                        incident = _row_to_incident(existing)
                        aggregate_to_incident(
                            conn,
                            incident=incident,
                            message_id=delivery.message_id,
                            delivery=delivery,
                        )
                        return IngestResult(
                            200,
                            {
                                "action": "aggregated_storm_race",
                                "incident_id": str(incident.id),
                            },
                        )

                    if deadline.loop_agent_budget_seconds() <= 0:
                        return IngestResult(
                            503, {"error": "insufficient investigation deadline"}
                        )
                    if not reserve_investigation_budget(
                        conn, self._settings.max_investigation_budget
                    ):
                        return self._escalate_in_transaction(
                            conn,
                            delivery,
                            alert,
                            embedding,
                            storm_key=storm_key,
                            kind="storm",
                        )

                    token = new_token()
                    lease = lease_expires_at(self._settings.lease_seconds)
                    vec = vector_to_pg(embedding)

                    storm_row = conn.execute(
                        """
                        INSERT INTO ops.incidents (
                            incident_key, incident_kind, storm_key, alert_policy, resource,
                            raw_alert, status, embedding, investigation_token, lease_expires_at
                        ) VALUES (%s, 'storm', %s, %s, %s, %s::jsonb, 'investigating', %s::vector, %s, %s)
                        RETURNING *
                        """,
                        (
                            storm_key,
                            storm_key,
                            delivery.alert_policy,
                            delivery.resource,
                            json.dumps(alert),
                            vec,
                            token,
                            lease,
                        ),
                    ).fetchone()
                    storm_id = storm_row["id"]

                    merge_normals_into_storm(
                        conn,
                        storm_id=storm_id,
                        resource=delivery.resource,
                        alert_policy=delivery.alert_policy,
                        new_token=token,
                    )

                    claimed = conn.execute(
                        """
                        UPDATE ops.alert_deliveries
                           SET status = 'processing',
                               is_owner = true,
                               incident_id = %s,
                               work_token = %s,
                               work_lease_expires_at = %s
                         WHERE message_id = %s
                           AND status = 'received'
                         RETURNING message_id
                        """,
                        (storm_id, token, lease, delivery.message_id),
                    ).fetchone()
                    if not claimed:
                        raise RuntimeError("storm owner claim lost after row lock")

        record_incident_opened()
        return InvestigationReady(
            incident_id=storm_id,
            delivery_message_id=delivery.message_id,
            investigation_token=token,
            work_token=token,
            alert=alert,
            embedding=embedding,
            playbook_hint=delivery.alert_policy,
            loop_budget_seconds=deadline.loop_agent_budget_seconds(),
        )

    def _ensure_embedding(
        self,
        delivery: DeliveryRow,
        alert: dict[str, Any],
        deadline: RequestDeadline,
        *,
        storm_key: str | None = None,
    ) -> list[float] | IngestResult:
        if delivery.embedding:
            return delivery.embedding

        with self._db.transaction() as conn:
            with ExitStack() as locks:
                if storm_key:
                    locks.enter_context(
                        resource_advisory_lock(
                            conn, delivery.resource, delivery.alert_policy
                        )
                    )
                    locks.enter_context(storm_advisory_lock(conn, storm_key))
                row = conn.execute(
                    "SELECT * FROM ops.alert_deliveries WHERE message_id = %s FOR UPDATE",
                    (delivery.message_id,),
                ).fetchone()
                if not row:
                    return IngestResult(500, {"error": "delivery missing"})
                current = _row_to_delivery(row)
                if current.status == "completed":
                    return IngestResult(200, {"action": "already_completed"})
                if current.status not in ("received", "embedding"):
                    return IngestResult(503, {"error": "embedding state advanced"})
                if current.embedding:
                    return current.embedding
                if storm_key:
                    existing = conn.execute(
                        """
                        SELECT * FROM ops.incidents
                         WHERE storm_key = %s
                           AND resolved_at IS NULL
                           AND status <> 'merged'
                         LIMIT 1
                        """,
                        (storm_key,),
                    ).fetchone()
                    if existing:
                        incident = _row_to_incident(existing)
                        aggregate_to_incident(
                            conn,
                            incident=incident,
                            message_id=current.message_id,
                            delivery=current,
                        )
                        return IngestResult(
                            200,
                            {
                                "action": "aggregated_storm_embedding_race",
                                "incident_id": str(incident.id),
                            },
                        )

                if not current.embedding_reserved:
                    if not reserve_embedding_budget(
                        conn, self._settings.max_embedding_budget
                    ):
                        return self._escalate_in_transaction(
                            conn,
                            current,
                            alert,
                            None,
                            storm_key=storm_key,
                            kind="storm" if storm_key else "normal",
                        )
                    conn.execute(
                        """
                        UPDATE ops.alert_deliveries
                           SET embedding_reserved = true
                         WHERE message_id = %s
                        """,
                        (delivery.message_id,),
                    )

        deadline.ensure_not_expired()
        token = new_token()
        lease = lease_expires_at(self._settings.embedding_lease_seconds)

        with self._db.transaction() as conn:
            updated = conn.execute(
                """
                UPDATE ops.alert_deliveries
                   SET status = 'embedding',
                       embedding_attempt_count = embedding_attempt_count + 1,
                       work_token = %s,
                       work_lease_expires_at = %s
                 WHERE message_id = %s
                   AND status IN ('received', 'embedding')
                   AND embedding IS NULL
                   AND embedding_attempt_count < 3
                   AND (work_lease_expires_at IS NULL OR work_lease_expires_at < now())
                 RETURNING *
                """,
                (token, lease, delivery.message_id),
            ).fetchone()
            if not updated:
                row = conn.execute(
                    "SELECT * FROM ops.alert_deliveries WHERE message_id = %s",
                    (delivery.message_id,),
                ).fetchone()
                if row and row.get("embedding"):
                    return parse_vector(row["embedding"]) or []
                return IngestResult(500, {"error": "embedding cas failed"})

        try:
            vec = self._embedding.embed(alert)
        except Exception:
            with self._db.transaction() as conn:
                with ExitStack() as locks:
                    if storm_key:
                        locks.enter_context(
                            resource_advisory_lock(
                                conn, delivery.resource, delivery.alert_policy
                            )
                        )
                        locks.enter_context(storm_advisory_lock(conn, storm_key))
                    row = conn.execute(
                        """
                        SELECT * FROM ops.alert_deliveries
                         WHERE message_id = %s
                         FOR UPDATE
                        """,
                        (delivery.message_id,),
                    ).fetchone()
                    if storm_key:
                        existing = conn.execute(
                            """
                            SELECT * FROM ops.incidents
                             WHERE storm_key = %s
                               AND resolved_at IS NULL
                               AND status <> 'merged'
                             LIMIT 1
                            """,
                            (storm_key,),
                        ).fetchone()
                        if existing and row:
                            incident = _row_to_incident(existing)
                            current = _row_to_delivery(row)
                            aggregate_to_incident(
                                conn,
                                incident=incident,
                                message_id=current.message_id,
                                delivery=current,
                            )
                            return IngestResult(
                                200,
                                {
                                    "action": "aggregated_storm_embedding_failure_race",
                                    "incident_id": str(incident.id),
                                },
                            )
                    if row and row["embedding_attempt_count"] >= 3:
                        return self._escalate_in_transaction(
                            conn,
                            _row_to_delivery(row),
                            alert,
                            None,
                            storm_key=storm_key,
                            kind="storm" if storm_key else "normal",
                        )
            return IngestResult(500, {"error": "embedding api failed"})

        with self._db.transaction() as conn:
            saved = conn.execute(
                """
                UPDATE ops.alert_deliveries
                   SET embedding = %s::vector,
                       status = 'received',
                       work_lease_expires_at = NULL
                 WHERE message_id = %s
                   AND work_token = %s
                   AND status = 'embedding'
                 RETURNING embedding
                """,
                (vector_to_pg(vec), delivery.message_id, token),
            ).fetchone()
            if not saved:
                return IngestResult(500, {"error": "embedding save cas failed"})
        return vec

    def _post_embedding_phase(
        self,
        delivery: DeliveryRow,
        alert: dict[str, Any],
        embedding: list[float],
        deadline: RequestDeadline,
    ) -> IngestResult | InvestigationReady:
        deadline.ensure_not_expired()
        l3_hit = False
        with self._db.transaction() as conn:
            with resource_advisory_lock(conn, delivery.resource, delivery.alert_policy):
                current = lock_claimable_delivery(conn, delivery.message_id)
                if isinstance(current, IngestResult):
                    return current
                delivery = current
                storm = find_open_storm(conn, delivery.resource, delivery.alert_policy)
                if storm:
                    aggregate_to_incident(
                        conn, incident=storm, message_id=delivery.message_id, delivery=delivery
                    )
                    return IngestResult(200, {"action": "aggregated_storm_post", "incident_id": str(storm.id)})

                l1 = find_l1_match(conn, delivery.incident_key)
                l2 = find_l2_candidate(
                    conn,
                    resource=delivery.resource,
                    alert_policy=delivery.alert_policy,
                    window_seconds=self._settings.l2_grouping_window_seconds,
                )
                rate = count_recent_deliveries(
                    conn,
                    resource=delivery.resource,
                    alert_policy=delivery.alert_policy,
                    window_seconds=self._settings.l3_storm_window_seconds,
                )
                l3_hit = rate > self._settings.l3_storm_threshold

                if l3_hit:
                    pass
                elif l1:
                    aggregate_to_incident(
                        conn, incident=l1, message_id=delivery.message_id, delivery=delivery
                    )
                    return IngestResult(200, {"action": "aggregated_l1_post", "incident_id": str(l1.id)})
                elif l2:
                    aggregate_to_incident(
                        conn, incident=l2, message_id=delivery.message_id, delivery=delivery
                    )
                    return IngestResult(200, {"action": "aggregated_l2_post", "incident_id": str(l2.id)})

        if l3_hit:
            return self._handle_storm_branch(delivery, alert, deadline)

        with self._db.transaction() as conn:
            with resource_advisory_lock(conn, delivery.resource, delivery.alert_policy):
                current = lock_claimable_delivery(conn, delivery.message_id)
                if isinstance(current, IngestResult):
                    return current
                delivery = current
                l4 = search_open_similar_incidents(
                    conn,
                    resource=delivery.resource,
                    alert_policy=delivery.alert_policy,
                    embedding=embedding,
                    threshold=self._settings.l4_cosine_threshold,
                )
                if l4:
                    aggregate_to_incident(
                        conn, incident=l4, message_id=delivery.message_id, delivery=delivery
                    )
                    return IngestResult(200, {"action": "aggregated_l4", "incident_id": str(l4.id)})

                if deadline.loop_agent_budget_seconds() <= 0:
                    return IngestResult(
                        503, {"error": "insufficient investigation deadline"}
                    )
                if not reserve_investigation_budget(
                    conn, self._settings.max_investigation_budget
                ):
                    return self._escalate_in_transaction(
                        conn, delivery, alert, embedding
                    )

                token = new_token()
                lease = lease_expires_at(self._settings.lease_seconds)
                vec = vector_to_pg(embedding)
                incident_row = conn.execute(
                    """
                    INSERT INTO ops.incidents (
                        incident_key, alert_policy, resource, raw_alert, status,
                        embedding, investigation_token, lease_expires_at
                    ) VALUES (%s, %s, %s, %s::jsonb, 'investigating', %s::vector, %s, %s)
                    RETURNING *
                    """,
                    (
                        delivery.incident_key,
                        delivery.alert_policy,
                        delivery.resource,
                        json.dumps(alert),
                        vec,
                        token,
                        lease,
                    ),
                ).fetchone()

                claimed = conn.execute(
                    """
                    UPDATE ops.alert_deliveries
                       SET status = 'processing',
                           is_owner = true,
                           incident_id = %s,
                           work_token = %s,
                           work_lease_expires_at = %s
                     WHERE message_id = %s
                       AND status = 'received'
                     RETURNING message_id
                    """,
                    (incident_row["id"], token, lease, delivery.message_id),
                ).fetchone()
                if not claimed:
                    raise RuntimeError("normal owner claim lost after row lock")

        record_incident_opened()
        return InvestigationReady(
            incident_id=incident_row["id"],
            delivery_message_id=delivery.message_id,
            investigation_token=token,
            work_token=token,
            alert=alert,
            embedding=embedding,
            playbook_hint=delivery.alert_policy,
            loop_budget_seconds=deadline.loop_agent_budget_seconds(),
        )

    def _escalate_in_transaction(
        self,
        conn: psycopg.Connection[Any],
        delivery: DeliveryRow,
        alert: dict[str, Any],
        embedding: list[float] | None,
        *,
        storm_key: str | None = None,
        kind: str = "normal",
    ) -> IngestResult:
        """Step 6: budget/embedding failure → escalated + fixed outbox."""
        vec_sql = vector_to_pg(embedding) if embedding else None
        unavailable = embedding is None

        if kind == "storm" and storm_key:
            token = new_token()
            incident_row = conn.execute(
                """
                INSERT INTO ops.incidents (
                    incident_key, incident_kind, storm_key, alert_policy, resource,
                    raw_alert, status, embedding, embedding_unavailable,
                    investigation_token, lease_expires_at
                ) VALUES (%s, 'storm', %s, %s, %s, %s::jsonb, 'escalated', %s::vector, %s, %s, now())
                RETURNING id
                """,
                (
                    storm_key,
                    storm_key,
                    delivery.alert_policy,
                    delivery.resource,
                    json.dumps(alert),
                    vec_sql,
                    unavailable,
                    token,
                ),
            ).fetchone()
            merge_normals_into_storm(
                conn,
                storm_id=incident_row["id"],
                resource=delivery.resource,
                alert_policy=delivery.alert_policy,
                new_token=token,
            )
        else:
            incident_row = conn.execute(
                """
                INSERT INTO ops.incidents (
                    incident_key, alert_policy, resource, raw_alert, status,
                    embedding, embedding_unavailable, investigation_token, lease_expires_at
                ) VALUES (%s, %s, %s, %s::jsonb, 'escalated', %s::vector, %s, %s, now())
                RETURNING id
                """,
                (
                    delivery.incident_key,
                    delivery.alert_policy,
                    delivery.resource,
                    json.dumps(alert),
                    vec_sql,
                    unavailable,
                    new_token(),
                ),
            ).fetchone()

        incident_id = incident_row["id"]
        for destination in ("slack", "github_issue"):
            conn.execute(
                """
                INSERT INTO ops.outbox (
                    incident_id, destination, idempotency_key, payload
                )
                VALUES (%s, %s, %s, %s::jsonb)
                ON CONFLICT (idempotency_key) DO NOTHING
                """,
                (
                    incident_id,
                    destination,
                    f"escalation:{destination}:{incident_id}",
                    json.dumps(FIXED_ESCALATION_OUTBOX),
                ),
            )
        if kind == "storm":
            create_storm_merge_outboxes(conn, storm_id=incident_id)
        conn.execute(
            """
            UPDATE ops.alert_deliveries
               SET status = 'completed',
                   is_owner = false,
                   completed_at = now(),
                   incident_id = %s,
                   work_token = gen_random_uuid(),
                   work_lease_expires_at = NULL
             WHERE message_id = %s
            """,
            (incident_id, delivery.message_id),
        )
        return IngestResult(200, {"action": "escalated", "incident_id": str(incident_id)})
