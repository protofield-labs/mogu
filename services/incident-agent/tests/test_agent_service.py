from __future__ import annotations

from uuid import uuid4

import agent.service as service_module
from agent.runtime import AnalysisResult
from agent.service import InvestigationService
from app.noise import InvestigationReady
from app.owner import SaveAnalysisResult
from tests.test_integration import _test_settings


class NoopRuntime:
    async def run(self, request, tools, scanner):
        raise AssertionError("runtime should not be called")


class NoopObservation:
    def get_metrics(self, query, *, start, end):
        return {}

    def get_logs(self, query, *, start, end):
        return {}


def _service() -> InvestigationService:
    return InvestigationService(
        object(),
        _test_settings(google_cloud_project="test-project"),
        runtime=NoopRuntime(),
        observation_client=NoopObservation(),
    )


def _ready() -> InvestigationReady:
    token = uuid4()
    return InvestigationReady(
        incident_id=uuid4(),
        delivery_message_id="message-1",
        investigation_token=token,
        work_token=token,
        alert={"v": 1},
        embedding=[0.0] * 768,
        playbook_hint=None,
        loop_budget_seconds=60,
    )


def test_retry_response_handles_mirrored_lease_runtime_error(monkeypatch) -> None:
    def fail_expiration(*args, **kwargs):
        raise RuntimeError("partial lease expiration forbidden")

    monkeypatch.setattr(service_module, "expire_owner_lease", fail_expiration)

    result = _service()._retry_after_expiring_lease(_ready(), "retry")

    assert result.status_code == 503
    assert result.body == {"error": "investigation owner state changed"}


def test_safety_save_runtime_error_returns_retry(monkeypatch) -> None:
    monkeypatch.setattr(
        service_module,
        "save_owner_analysis",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("CAS failed")),
    )
    monkeypatch.setattr(
        service_module,
        "expire_owner_lease",
        lambda *args, **kwargs: True,
    )

    result = _service()._save_safety_escalation(_ready())

    assert result.status_code == 503
    assert result.body == {"error": "safety escalation save failed"}


def test_safety_escalation_creates_slack_and_github_issue(monkeypatch) -> None:
    captured = {}

    def save(*args, **kwargs):
        captured.update(kwargs)
        return SaveAnalysisResult(success=True, status_code=200)

    monkeypatch.setattr(service_module, "save_owner_analysis", save)

    result = _service()._save_safety_escalation(_ready())

    assert result.status_code == 200
    assert [entry["destination"] for entry in captured["outbox_entries"]] == [
        "slack",
        "github_issue",
    ]


def test_failed_analysis_save_expires_owner_lease(monkeypatch) -> None:
    expired = []
    monkeypatch.setattr(
        service_module,
        "save_owner_analysis",
        lambda *args, **kwargs: SaveAnalysisResult(
            success=False,
            status_code=500,
            reason="incident cas failed",
        ),
    )
    monkeypatch.setattr(
        service_module,
        "expire_owner_lease",
        lambda *args, **kwargs: expired.append(True) or True,
    )
    analysis = AnalysisResult(
        hypothesis="database waits increased",
        evidence=["latency rose at the same time"],
        severity="high",
        recommended_actions=["compare the previous revision"],
        confidence="high",
        loop_count=1,
        token_cost=10,
        playbook_used="default.md",
    )

    result = _service()._save_analysis(_ready(), analysis)

    assert result.status_code == 503
    assert result.body == {"error": "incident cas failed"}
    assert expired == [True]
