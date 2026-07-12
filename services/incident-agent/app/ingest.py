from __future__ import annotations

import base64
from datetime import datetime, timezone
import json
import re
from typing import Any

from app.adapter import AdapterError, adapt_monitoring_payload
from app.config import Settings
from app.db import Database
from app.deadline import RequestDeadline, lease_expires_at
from app.embedding import DeterministicEmbeddingClient, EmbeddingClient, VertexEmbeddingClient
from app.keys import compute_fallback_incident_key, compute_incident_key
from app.masking import MaskingError, mask_alert
from app.noise import DeliveryRow, IngestResult, InvestigationReady, NoiseOrchestrator, _row_to_delivery
from app.self_exclude import is_self_excluded

_MESSAGE_ID_RE = re.compile(r"^[A-Za-z0-9\-_+/=]{1,256}$")

PLACEHOLDER_ALERT = {"masking_pending": True}


class IngestService:
    def __init__(
        self,
        db: Database,
        settings: Settings,
        embedding_client: EmbeddingClient | None = None,
    ):
        self._db = db
        self._settings = settings
        if embedding_client is not None:
            self._embedding = embedding_client
        elif settings.embedding_backend == "deterministic":
            self._embedding = DeterministicEmbeddingClient()
        else:
            self._embedding = VertexEmbeddingClient(
                project_id=settings.google_cloud_project,
                location=settings.vertex_location,
                model=settings.embedding_model,
            )
        self._orchestrator = NoiseOrchestrator(db, settings, self._embedding)

    def handle_pubsub(self, body: dict[str, Any], deadline: RequestDeadline) -> IngestResult:
        message = body.get("message")
        if not isinstance(message, dict):
            return IngestResult(400, {"error": "invalid pubsub envelope"})

        message_id = message.get("messageId") or message.get("message_id")
        if not isinstance(message_id, str) or not _MESSAGE_ID_RE.fullmatch(message_id):
            return IngestResult(400, {"error": "invalid messageId"})

        data_b64 = message.get("data", "")
        try:
            raw_payload = json.loads(base64.b64decode(data_b64))
        except Exception:
            return IngestResult(400, {"error": "invalid message data"})
        if not isinstance(raw_payload, dict):
            raw_payload = {}

        # Step 1: checkpoint before masking
        checkpoint = self._checkpoint(message_id, raw_payload)
        if isinstance(checkpoint, IngestResult):
            return checkpoint

        delivery, is_new = checkpoint

        if delivery.status == "completed":
            return IngestResult(200, {"action": "already_completed"})

        if delivery.status == "embedding":
            if (
                delivery.work_lease_expires_at
                and delivery.work_lease_expires_at > datetime.now(timezone.utc)
            ):
                return IngestResult(503, {"error": "embedding in progress"})
            # Lease expired — retry step 4
            if delivery.sanitized_alert.get("masking_pending"):
                return IngestResult(500, {"error": "inconsistent embedding state"})
            return self._orchestrator.resume_embedding(
                delivery, delivery.sanitized_alert, deadline
            )

        if (
            delivery.is_owner
            and delivery.status == "processing"
            and delivery.incident_id
        ):
            return self._resume_owner(delivery, deadline)

        if delivery.sanitized_alert.get("masking_pending"):
            if is_new:
                return self._mask_and_continue(delivery, raw_payload, deadline)
            # Redelivery: do not re-interpret raw payload (§9 step 1)
            if (
                delivery.work_lease_expires_at
                and delivery.work_lease_expires_at > datetime.now(timezone.utc)
            ):
                return IngestResult(503, {"error": "masking in progress"})
            return self._masking_failure_escalation(delivery)

        if delivery.status == "received" and not delivery.sanitized_alert.get("masking_pending"):
            return self._orchestrator.run_after_masking(
                delivery, delivery.sanitized_alert, deadline
            )

        return IngestResult(500, {"error": "inconsistent delivery state"})

    def _checkpoint(
        self, message_id: str, raw_payload: dict[str, Any]
    ) -> tuple[DeliveryRow, bool] | IngestResult:
        """Step 1: messageId idempotency placeholder insert. Returns (delivery, is_new)."""
        try:
            adapted = adapt_monitoring_payload(
                raw_payload,
                allowed_resources=self._settings.allowed_resources,
                allowed_alert_policies=self._settings.allowed_alert_policies,
            )
        except AdapterError:
            resource = "unknown"
            policy = "unknown"
            if isinstance(raw_payload.get("incident"), dict):
                inc = raw_payload["incident"]
                raw_resource = str(inc.get("resource_name") or "unknown")
                if is_self_excluded(raw_resource, self._settings):
                    return IngestResult(
                        200,
                        {"action": "self_excluded", "resource": raw_resource},
                    )
            fallback_key = compute_fallback_incident_key(
                message_id=message_id, resource=resource, alert_policy=policy
            )
            with self._db.transaction() as conn:
                inserted = conn.execute(
                    """
                    INSERT INTO ops.alert_deliveries (
                        message_id, resource, alert_policy, incident_key, sanitized_alert,
                        work_lease_expires_at
                    ) VALUES (%s, %s, %s, %s, %s::jsonb, %s)
                    ON CONFLICT (message_id) DO NOTHING
                    RETURNING message_id
                    """,
                    (
                        message_id,
                        resource,
                        policy,
                        fallback_key,
                        json.dumps(PLACEHOLDER_ALERT),
                        lease_expires_at(self._settings.embedding_lease_seconds),
                    ),
                ).fetchone()
                row = conn.execute(
                    "SELECT * FROM ops.alert_deliveries WHERE message_id = %s",
                    (message_id,),
                ).fetchone()
            if row:
                delivery = _row_to_delivery(row)
                if delivery.status == "completed":
                    return IngestResult(200, {"action": "already_completed"})
                return delivery, inserted is not None
            return IngestResult(500, {"error": "adapter checkpoint failed"})

        if is_self_excluded(adapted.resource, self._settings):
            return IngestResult(
                200,
                {"action": "self_excluded", "resource": adapted.resource},
            )

        fallback_key = compute_fallback_incident_key(
            message_id=message_id,
            resource=adapted.resource,
            alert_policy=adapted.alert_policy,
            masking_error=False,
        )

        with self._db.transaction() as conn:
            inserted = conn.execute(
                """
                INSERT INTO ops.alert_deliveries (
                    message_id, resource, alert_policy, incident_key, sanitized_alert,
                    work_lease_expires_at
                ) VALUES (%s, %s, %s, %s, %s::jsonb, %s)
                ON CONFLICT (message_id) DO NOTHING
                RETURNING message_id
                """,
                (
                    message_id,
                    adapted.resource,
                    adapted.alert_policy,
                    fallback_key,
                    json.dumps(PLACEHOLDER_ALERT),
                    lease_expires_at(self._settings.embedding_lease_seconds),
                ),
            ).fetchone()
            row = conn.execute(
                "SELECT * FROM ops.alert_deliveries WHERE message_id = %s",
                (message_id,),
            ).fetchone()

        if not row:
            return IngestResult(500, {"error": "checkpoint failed"})
        return _row_to_delivery(row), inserted is not None

    def _mask_and_continue(
        self,
        delivery: DeliveryRow,
        raw_payload: dict[str, Any],
        deadline: RequestDeadline,
    ) -> IngestResult | InvestigationReady:
        try:
            adapted = adapt_monitoring_payload(
                raw_payload,
                allowed_resources=self._settings.allowed_resources,
                allowed_alert_policies=self._settings.allowed_alert_policies,
            )
            alert = mask_alert(adapted.to_dict())
            incident_key = compute_incident_key(alert)
        except (AdapterError, MaskingError):
            return self._masking_failure_escalation(delivery)

        with self._db.transaction() as conn:
            updated = conn.execute(
                """
                UPDATE ops.alert_deliveries
                   SET incident_key = %s,
                       sanitized_alert = %s::jsonb,
                       status = 'received',
                       work_lease_expires_at = NULL
                 WHERE message_id = %s
                   AND status = 'received'
                   AND sanitized_alert = %s::jsonb
                   AND work_token = %s
                 RETURNING *
                """,
                (
                    incident_key,
                    json.dumps(alert),
                    delivery.message_id,
                    json.dumps(PLACEHOLDER_ALERT),
                    delivery.work_token,
                ),
            ).fetchone()
            if not updated:
                row = conn.execute(
                    "SELECT * FROM ops.alert_deliveries WHERE message_id = %s",
                    (delivery.message_id,),
                ).fetchone()
                if row and not row["sanitized_alert"].get("masking_pending"):
                    delivery = _row_to_delivery(row)
                    if delivery.status == "completed":
                        return IngestResult(200, {"action": "already_completed"})
                    alert = delivery.sanitized_alert
                else:
                    return IngestResult(500, {"error": "masking cas failed"})
            else:
                delivery = _row_to_delivery(updated)

        deadline.ensure_not_expired()
        result = self._orchestrator.run_after_masking(delivery, alert, deadline)
        return result

    def _masking_failure_escalation(self, delivery: DeliveryRow) -> IngestResult:
        """§7-10: masking fail → escalated + fixed outbox + completed."""
        if delivery.status == "completed":
            return IngestResult(200, {"action": "already_completed"})
        safe_alert = {
            "v": 1,
            "alert_policy": delivery.alert_policy,
            "resource": delivery.resource,
            "service": None,
            "host": None,
            "message": None,
            "masking_error": True,
        }
        fallback_key = compute_fallback_incident_key(
            message_id=delivery.message_id,
            resource=delivery.resource,
            alert_policy=delivery.alert_policy,
        )

        with self._db.transaction() as conn:
            current = conn.execute(
                "SELECT * FROM ops.alert_deliveries WHERE message_id = %s FOR UPDATE",
                (delivery.message_id,),
            ).fetchone()
            if not current:
                return IngestResult(500, {"error": "masking delivery missing"})
            current_delivery = _row_to_delivery(current)
            if current_delivery.status == "completed":
                return IngestResult(200, {"action": "already_completed"})
            if not current_delivery.sanitized_alert.get("masking_pending"):
                return IngestResult(503, {"error": "masking state advanced"})

            incident = conn.execute(
                """
                INSERT INTO ops.incidents (
                    incident_key, alert_policy, resource, raw_alert, status,
                    embedding_unavailable, investigation_token, lease_expires_at
                ) VALUES (%s, %s, %s, %s::jsonb, 'escalated', true, gen_random_uuid(), now())
                RETURNING id
                """,
                (
                    fallback_key,
                    delivery.alert_policy,
                    delivery.resource,
                    json.dumps(safe_alert),
                ),
            ).fetchone()

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
                        incident["id"],
                        destination,
                        f"masking-escalation:{destination}:{incident['id']}",
                        json.dumps(
                            {
                                "text": (
                                    "Alert received but sanitization failed. "
                                    "Manual review required."
                                )
                            }
                        ),
                    ),
                )

            conn.execute(
                """
                UPDATE ops.alert_deliveries
                   SET status = 'completed',
                       incident_key = %s,
                       sanitized_alert = %s::jsonb,
                       incident_id = %s,
                       completed_at = now(),
                       work_token = gen_random_uuid(),
                       work_lease_expires_at = NULL
                 WHERE message_id = %s
                """,
                (
                    fallback_key,
                    json.dumps(safe_alert),
                    incident["id"],
                    delivery.message_id,
                ),
            )

        return IngestResult(200, {"action": "masking_escalated", "incident_id": str(incident["id"])})

    def _resume_owner(
        self, delivery: DeliveryRow, deadline: RequestDeadline
    ) -> IngestResult | InvestigationReady:
        """Owner redelivery: lease valid → 5xx; expired → CAS renew then resume."""
        from app.owner import renew_owner_lease

        now = datetime.now(timezone.utc)
        lease_valid = (
            delivery.work_lease_expires_at and delivery.work_lease_expires_at > now
        )

        with self._db.connection() as conn:
            incident_row = conn.execute(
                "SELECT * FROM ops.incidents WHERE id = %s", (delivery.incident_id,)
            ).fetchone()

        if not incident_row:
            return IngestResult(500, {"error": "owner incident missing"})

        if incident_row["status"] != "investigating":
            return IngestResult(200, {"action": "owner_already_finished"})

        if lease_valid:
            return IngestResult(503, {"error": "owner lease active"})
        if deadline.loop_agent_budget_seconds() <= 0:
            return IngestResult(503, {"error": "insufficient investigation deadline"})

        renewed = renew_owner_lease(
            self._db,
            incident_id=delivery.incident_id,
            delivery_message_id=delivery.message_id,
            investigation_token=incident_row["investigation_token"],
            work_token=delivery.work_token,
            lease_seconds=self._settings.lease_seconds,
        )
        if not renewed.success:
            if incident_row["attempt_count"] >= 3:
                from app.owner import save_final_escalation

                final = save_final_escalation(
                    self._db,
                    incident_id=delivery.incident_id,
                    delivery_message_id=delivery.message_id,
                    investigation_token=incident_row["investigation_token"],
                    work_token=delivery.work_token,
                )
                if final.success:
                    return IngestResult(200, {"action": "owner_exhausted"})
                return IngestResult(
                    final.status_code,
                    {"error": final.reason or "owner escalation cas failed"},
                )
            return IngestResult(503, {"error": "owner lease renew failed"})

        alert = delivery.sanitized_alert
        embedding = delivery.embedding or []
        return InvestigationReady(
            incident_id=delivery.incident_id,
            delivery_message_id=delivery.message_id,
            investigation_token=renewed.new_token,
            work_token=renewed.new_token,
            alert=alert,
            embedding=embedding,
            playbook_hint=delivery.alert_policy,
            loop_budget_seconds=deadline.loop_agent_budget_seconds(),
        )
