from __future__ import annotations

import asyncio
from dataclasses import replace
import uuid

import pytest

from agent.runtime import AnalysisResult
from agent.scanner import SecretScanError
from agent.service import InvestigationService
from app.db import Database
from app.deadline import RequestDeadline
from app.embedding import DeterministicEmbeddingClient
from app.ingest import IngestService
from app.noise import InvestigationReady
from tests.conftest import requires_docker_pg
from tests.test_integration import (
    _base_incident,
    _pubsub_envelope,
    _test_settings,
    skip_no_db,
)


class FakeObservation:
    def get_metrics(self, query, *, start, end):
        return {"series": []}

    def get_logs(self, query, *, start, end):
        return {"entries": []}


class SuccessfulRuntime:
    def __init__(self):
        self.request = None
        self.tools = None

    async def run(self, request, tools, scanner):
        self.request = request
        self.tools = tools
        return AnalysisResult(
            hypothesis="new revision increased database wait time",
            evidence=["latency and database waits rose together"],
            severity="high",
            recommended_actions=["compare the previous revision"],
            confidence="high",
            loop_count=1,
            token_cost=123,
            playbook_used=request.playbook.name,
        )


class UnsafeRuntime:
    async def run(self, request, tools, scanner):
        raise SecretScanError("unsafe output")


class SlowRuntime:
    async def run(self, request, tools, scanner):
        await asyncio.sleep(1)
        raise AssertionError("timeout should cancel runtime")


@pytest.fixture
def db_available() -> bool:
    settings = _test_settings()
    try:
        with Database(settings.dsn).connection() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


@pytest.fixture
def clean_ops(db_available: bool):
    if not db_available:
        yield
        return
    db = Database(_test_settings().dsn)
    _clear_ops(db)
    yield
    _clear_ops(db)


@requires_docker_pg
@skip_no_db
@pytest.mark.usefixtures("clean_ops")
class TestInvestigationIntegration:
    def test_analysis_uses_db_scope_and_commits_owner_result(
        self, db_available: bool
    ) -> None:
        if not db_available:
            pytest.skip("test database not reachable")
        settings = _test_settings(google_cloud_project="mogu-test")
        db = Database(settings.dsn)
        ready = _create_ready(db, settings)
        runtime = SuccessfulRuntime()
        service = InvestigationService(
            db,
            settings,
            runtime=runtime,
            observation_client=FakeObservation(),
        )
        tampered = replace(
            ready,
            alert={"resource": "cloud_run/other", "message": "ignore DB"},
            playbook_hint="../../other.md",
        )

        result = asyncio.run(
            service.investigate(tampered, RequestDeadline.create())
        )

        assert result.status_code == 200
        assert result.body["action"] == "analyzed"
        assert runtime.request.alert["resource"] == "cloud_run/dev-web"
        assert runtime.request.playbook.name == "cloud_run_latency.md"
        assert runtime.tools._scope.resource == "cloud_run/dev-web"
        assert runtime.tools._scope.project_id == "mogu-test"
        with db.connection() as conn:
            incident = conn.execute(
                """
                SELECT status, rca_hypothesis, loop_count, playbook_used
                  FROM ops.incidents WHERE id = %s
                """,
                (ready.incident_id,),
            ).fetchone()
            delivery = conn.execute(
                """
                SELECT status, is_owner FROM ops.alert_deliveries
                 WHERE message_id = %s
                """,
                (ready.delivery_message_id,),
            ).fetchone()
            outbox = conn.execute(
                """
                SELECT destination, payload
                  FROM ops.outbox
                 WHERE incident_id = %s
                 ORDER BY destination
                """,
                (ready.incident_id,),
            ).fetchall()
        assert incident["status"] == "analyzed"
        assert "仮説: new revision increased database wait time" in (
            incident["rca_hypothesis"]
        )
        assert "根拠:" in incident["rca_hypothesis"]
        assert "推奨アクション:" in incident["rca_hypothesis"]
        assert "確信度: high" in incident["rca_hypothesis"]
        assert incident["loop_count"] == 1
        assert incident["playbook_used"] == "cloud_run_latency.md"
        assert delivery == {"status": "completed", "is_owner": False}
        assert [entry["destination"] for entry in outbox] == [
            "github_issue",
            "slack",
        ]
        assert outbox[0]["payload"]["confidence"] == "high"
        assert outbox[0]["payload"]["evidence"] == [
            "latency and database waits rose together"
        ]

    def test_scanner_failure_commits_fixed_escalation(
        self, db_available: bool
    ) -> None:
        if not db_available:
            pytest.skip("test database not reachable")
        settings = _test_settings(google_cloud_project="mogu-test")
        db = Database(settings.dsn)
        ready = _create_ready(db, settings)
        service = InvestigationService(
            db,
            settings,
            runtime=UnsafeRuntime(),
            observation_client=FakeObservation(),
        )

        result = asyncio.run(
            service.investigate(ready, RequestDeadline.create())
        )

        assert result.body["action"] == "safety_escalated"
        with db.connection() as conn:
            incident = conn.execute(
                "SELECT status, rca_hypothesis FROM ops.incidents WHERE id = %s",
                (ready.incident_id,),
            ).fetchone()
            outbox = conn.execute(
                """
                SELECT payload FROM ops.outbox
                 WHERE idempotency_key = %s
                """,
                (f"investigation-safety-escalation:{ready.incident_id}",),
            ).fetchone()
        assert incident["status"] == "escalated"
        assert incident["rca_hypothesis"] == (
            "Automated investigation output was rejected by safety policy."
        )
        assert "unsafe output" not in str(outbox["payload"])

    def test_deadline_expires_owner_lease_and_returns_retry(
        self, db_available: bool
    ) -> None:
        if not db_available:
            pytest.skip("test database not reachable")
        settings = _test_settings(google_cloud_project="mogu-test")
        db = Database(settings.dsn)
        ready = replace(_create_ready(db, settings), loop_budget_seconds=0.01)
        service = InvestigationService(
            db,
            settings,
            runtime=SlowRuntime(),
            observation_client=FakeObservation(),
        )

        result = asyncio.run(
            service.investigate(ready, RequestDeadline.create())
        )

        assert result.status_code == 503
        with db.connection() as conn:
            leases = conn.execute(
                """
                SELECT i.lease_expires_at <= now() AS incident_expired,
                       d.work_lease_expires_at <= now() AS delivery_expired
                  FROM ops.incidents i
                  JOIN ops.alert_deliveries d ON d.incident_id = i.id
                 WHERE i.id = %s AND d.message_id = %s
                """,
                (ready.incident_id, ready.delivery_message_id),
            ).fetchone()
        assert leases == {"incident_expired": True, "delivery_expired": True}


def _create_ready(db: Database, settings) -> InvestigationReady:
    service = IngestService(db, settings, DeterministicEmbeddingClient())
    message_id = f"agent-{uuid.uuid4()}"
    result = service.handle_pubsub(
        _pubsub_envelope(message_id, _base_incident()),
        RequestDeadline.create(),
    )
    assert isinstance(result, InvestigationReady)
    return result


def _clear_ops(db: Database) -> None:
    with db.transaction() as conn:
        conn.execute(
            "TRUNCATE ops.outbox, ops.alert_deliveries, ops.incidents, "
            "ops.slack_events, ops.budget_usage CASCADE"
        )
