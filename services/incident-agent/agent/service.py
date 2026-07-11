from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from agent.playbooks import PlaybookError, PlaybookLoader
from agent.runtime import (
    AdkInvestigationRuntime,
    AnalysisResult,
    InvestigationRuntime,
    InvestigationRuntimeError,
    RuntimeRequest,
)
from agent.scanner import SecretScanError, SecretScanner
from agent.tools import (
    BoundInvestigationTools,
    GoogleObservationClient,
    IncidentToolScope,
    ObservationClient,
    ToolScopeError,
)
from app.config import Settings
from app.db import Database, parse_vector
from app.deadline import RequestDeadline
from app.noise import IngestResult, InvestigationReady
from app.owner import expire_owner_lease, save_owner_analysis

FIXED_SAFETY_ESCALATION = {
    "severity": "high",
    "rca_hypothesis": "Automated investigation output was rejected by safety policy.",
}
FIXED_SAFETY_OUTBOX = {
    "text": (
        "Automated investigation was stopped because its output could not be "
        "sanitized safely. Manual review required."
    )
}


@dataclass(frozen=True)
class _OwnerContext:
    scope: IncidentToolScope
    alert: dict[str, Any]


class InvestigationService:
    def __init__(
        self,
        db: Database,
        settings: Settings,
        *,
        runtime: InvestigationRuntime | None = None,
        observation_client: ObservationClient | None = None,
        scanner: SecretScanner | None = None,
        playbooks: PlaybookLoader | None = None,
    ):
        self._db = db
        self._settings = settings
        self._scanner = scanner or SecretScanner()
        self._playbooks = playbooks or PlaybookLoader(scanner=self._scanner)
        self._runtime = runtime or AdkInvestigationRuntime(
            project_id=settings.google_cloud_project,
            location=settings.vertex_location,
            model_name=settings.agent_model,
        )
        self._observation_client = observation_client

    async def investigate(
        self,
        ready: InvestigationReady,
        deadline: RequestDeadline,
    ) -> IngestResult:
        budget = min(
            ready.loop_budget_seconds,
            deadline.loop_agent_budget_seconds(),
        )
        if budget <= 0:
            return self._retry_after_expiring_lease(
                ready, "insufficient investigation deadline"
            )

        owner = self._load_owner_context(ready)
        if isinstance(owner, IngestResult):
            return owner
        try:
            observation = self._observation_client or GoogleObservationClient(
                owner.scope.project_id
            )
        except ToolScopeError:
            return self._retry_after_expiring_lease(
                ready, "investigation service configuration invalid"
            )
        try:
            playbook = self._playbooks.load(owner.scope.alert_policy)
            tools = BoundInvestigationTools(
                self._db,
                owner.scope,
                observation,
                self._scanner,
            )
            result = await asyncio.wait_for(
                self._runtime.run(
                    RuntimeRequest(
                        incident_id=str(owner.scope.incident_id),
                        alert=self._scanner.sanitize_payload(owner.alert),
                        playbook=playbook,
                        loop_budget_seconds=budget,
                    ),
                    tools,
                    self._scanner,
                ),
                timeout=budget,
            )
            return self._save_analysis(ready, result)
        except (SecretScanError, PlaybookError, ToolScopeError):
            return self._save_safety_escalation(ready)
        except (asyncio.TimeoutError, InvestigationRuntimeError):
            return self._retry_after_expiring_lease(
                ready, "investigation execution failed"
            )
        except Exception:
            return self._retry_after_expiring_lease(
                ready, "investigation execution failed"
            )

    def _load_owner_context(
        self, ready: InvestigationReady
    ) -> _OwnerContext | IngestResult:
        with self._db.connection() as conn:
            incident = conn.execute(
                """
                SELECT id, status, resource, alert_policy, raw_alert,
                       investigation_token, embedding
                  FROM ops.incidents
                 WHERE id = %s
                """,
                (ready.incident_id,),
            ).fetchone()
            delivery = conn.execute(
                """
                SELECT incident_id, status, is_owner, work_token,
                       sanitized_alert, embedding
                  FROM ops.alert_deliveries
                 WHERE message_id = %s
                """,
                (ready.delivery_message_id,),
            ).fetchone()
        if (
            not incident
            or incident["status"] != "investigating"
            or incident["investigation_token"] != ready.investigation_token
            or not delivery
            or delivery["incident_id"] != ready.incident_id
            or delivery["status"] != "processing"
            or not delivery["is_owner"]
            or delivery["work_token"] != ready.work_token
        ):
            return IngestResult(503, {"error": "investigation owner state changed"})

        embedding = parse_vector(delivery.get("embedding")) or parse_vector(
            incident.get("embedding")
        )
        if not embedding:
            return IngestResult(503, {"error": "investigation embedding missing"})
        alert = delivery["sanitized_alert"]
        if not isinstance(alert, dict):
            return IngestResult(503, {"error": "canonical alert missing"})
        return _OwnerContext(
            scope=IncidentToolScope(
                incident_id=incident["id"],
                project_id=self._settings.google_cloud_project,
                resource=incident["resource"],
                alert_policy=incident["alert_policy"],
                embedding=embedding,
            ),
            alert=alert,
        )

    def _save_analysis(
        self,
        ready: InvestigationReady,
        result: AnalysisResult,
    ) -> IngestResult:
        analysis_payload = self._scanner.sanitize_payload(
            {
                "schema_version": 1,
                "kind": "primary_investigation",
                "hypothesis": result.hypothesis,
                "evidence": result.evidence,
                "severity": result.severity,
                "recommended_actions": result.recommended_actions,
                "confidence": result.confidence,
                "loop_count": result.loop_count,
                "token_cost": result.token_cost,
                "playbook_used": result.playbook_used,
            }
        )
        if not isinstance(analysis_payload, dict):
            raise SecretScanError("analysis payload must be an object")
        saved = save_owner_analysis(
            self._db,
            incident_id=ready.incident_id,
            delivery_message_id=ready.delivery_message_id,
            investigation_token=ready.investigation_token,
            work_token=ready.work_token,
            analysis={
                "severity": result.severity,
                "rca_hypothesis": _format_rca_summary(result),
                "loop_count": result.loop_count,
                "token_cost": result.token_cost,
                "playbook_used": result.playbook_used,
            },
            outbox_entries=[
                {
                    "destination": "slack",
                    "idempotency_key": f"primary-slack:{ready.incident_id}",
                    "payload": analysis_payload,
                },
                {
                    "destination": "github_issue",
                    "idempotency_key": f"primary-github-issue:{ready.incident_id}",
                    "payload": analysis_payload,
                },
            ],
        )
        if not saved.success:
            return self._retry_after_expiring_lease(
                ready,
                saved.reason or "analysis save failed",
            )
        return IngestResult(
            200,
            {
                "action": "analyzed",
                "incident_id": str(ready.incident_id),
                "confidence": result.confidence,
            },
        )

    def _save_safety_escalation(
        self, ready: InvestigationReady
    ) -> IngestResult:
        try:
            saved = save_owner_analysis(
                self._db,
                incident_id=ready.incident_id,
                delivery_message_id=ready.delivery_message_id,
                investigation_token=ready.investigation_token,
                work_token=ready.work_token,
                analysis=FIXED_SAFETY_ESCALATION,
                outbox_entries=[
                    {
                        "destination": "slack",
                        "idempotency_key": (
                            f"investigation-safety-escalation:{ready.incident_id}"
                        ),
                        "payload": FIXED_SAFETY_OUTBOX,
                    }
                ],
                escalate=True,
            )
        except RuntimeError:
            return self._retry_after_expiring_lease(
                ready, "safety escalation save failed"
            )
        if not saved.success:
            return self._retry_after_expiring_lease(
                ready,
                saved.reason or "safety escalation save failed",
            )
        return IngestResult(
            200,
            {
                "action": "safety_escalated",
                "incident_id": str(ready.incident_id),
            },
        )

    def _retry_after_expiring_lease(
        self,
        ready: InvestigationReady,
        reason: str,
    ) -> IngestResult:
        try:
            expired = expire_owner_lease(
                self._db,
                incident_id=ready.incident_id,
                delivery_message_id=ready.delivery_message_id,
                investigation_token=ready.investigation_token,
                work_token=ready.work_token,
            )
        except RuntimeError:
            return IngestResult(503, {"error": "investigation owner state changed"})
        if not expired:
            return IngestResult(503, {"error": "investigation owner state changed"})
        return IngestResult(503, {"error": reason})


def _format_rca_summary(result: AnalysisResult) -> str:
    evidence = "\n".join(f"- {item}" for item in result.evidence)
    actions = "\n".join(f"- {item}" for item in result.recommended_actions)
    return (
        f"仮説: {result.hypothesis}\n"
        f"根拠:\n{evidence}\n"
        f"重大度: {result.severity}\n"
        f"推奨アクション:\n{actions}\n"
        f"確信度: {result.confidence}"
    )
