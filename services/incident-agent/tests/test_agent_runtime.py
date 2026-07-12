from __future__ import annotations

import asyncio
from contextlib import contextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from google.adk.tools import FunctionTool

import agent.runtime as runtime_module
from agent.playbooks import LoadedPlaybook
from agent.runtime import (
    AdkInvestigationRuntime,
    LoopTerminationAgent,
    RuntimeRequest,
    _SafetyCallbacks,
)
from agent.scanner import SecretScanner
from agent.tools import BoundInvestigationTools, IncidentToolScope


EVALUATION = {
    "hypothesis": "新しいリビジョンでデータベース待機時間が増加した",
    "evidence": ["リビジョン変更時点から latency が上昇した"],
    "severity": "high",
    "recommended_actions": ["以前のリビジョンとの設定差分を確認する"],
    "confidence": "high",
}


class FakeObservation:
    def get_metrics(self, query, *, start, end):
        return {"series": []}

    def get_logs(self, query, *, start, end):
        return {"entries": []}


class FakeDB:
    @contextmanager
    def connection(self):
        yield None


class FakeSessionService:
    def __init__(self):
        self.session = None

    async def create_session(self, *, app_name, user_id, state, session_id=None):
        self.session = SimpleNamespace(id="session-1", state=dict(state))
        return self.session

    async def get_session(self, *, app_name, user_id, session_id, config=None):
        return self.session


class FakeRunner:
    last_agent = None
    last_message = None

    def __init__(self, *, agent, app_name, session_service):
        FakeRunner.last_agent = agent
        self._sessions = session_service

    async def run_async(self, **kwargs):
        FakeRunner.last_message = kwargs.get("new_message")
        self._sessions.session.state.update(
            {"evaluation": EVALUATION, "loop_count": 1}
        )
        yield SimpleNamespace(
            usage_metadata=SimpleNamespace(total_token_count=123)
        )


def _bound_tools() -> BoundInvestigationTools:
    return BoundInvestigationTools(
        FakeDB(),
        IncidentToolScope(
            incident_id=uuid4(),
            project_id="test-project",
            resource="cloud_run/dev-web",
            alert_policy="dev-web-latency",
            embedding=[0.0] * 768,
        ),
        FakeObservation(),
        SecretScanner(),
        clock=lambda: datetime(2026, 7, 12, tzinfo=timezone.utc),
    )


def test_adk_runtime_builds_three_iteration_loop_and_parses_result(
    monkeypatch,
) -> None:
    monkeypatch.setattr(runtime_module, "InMemorySessionService", FakeSessionService)
    monkeypatch.setattr(runtime_module, "Runner", FakeRunner)
    monkeypatch.setattr(
        runtime_module,
        "Gemini",
        lambda **kwargs: "gemini-2.5-flash",
    )
    runtime = AdkInvestigationRuntime(
        project_id="test-project",
        location="asia-northeast1",
        model_name="gemini-2.5-flash",
    )

    result = asyncio.run(
        runtime.run(
            RuntimeRequest(
                incident_id="0d9e4c1a-8f27-4b53-9c66-2f3a51e7b804",
                alert={"resource": "cloud_run/dev-web", "v": 1},
                playbook=LoadedPlaybook("default.md", "Inspect metrics, then logs."),
                loop_budget_seconds=30,
            ),
            _bound_tools(),
            SecretScanner(),
        )
    )

    assert FakeRunner.last_agent.max_iterations == 3
    assert [agent.name for agent in FakeRunner.last_agent.sub_agents] == [
        "investigator",
        "evaluator",
        "confidence_checker",
    ]
    for sub_agent in FakeRunner.last_agent.sub_agents[:2]:
        assert sub_agent.generate_content_config.max_output_tokens == 2048
        assert "Japanese" in sub_agent.instruction
    # Full UUIDs would be redacted by the 32-char entropy mask; only the
    # short prefix may reach the model.
    message_text = FakeRunner.last_message.parts[0].text
    assert '"incident_ref":"0d9e4c1a"' in message_text
    assert "[REDACTED]" not in message_text
    assert result.loop_count == 1
    assert result.token_cost == 123
    assert result.confidence == "high"


def test_model_callbacks_accept_adk_keyword_arguments() -> None:
    callbacks = _SafetyCallbacks(SecretScanner(), _bound_tools())
    request = SimpleNamespace(
        contents=[
            SimpleNamespace(parts=[SimpleNamespace(text="safe investigation input")])
        ]
    )
    response = SimpleNamespace(content=None)

    assert (
        callbacks.before_model(
            callback_context=SimpleNamespace(),
            llm_request=request,
        )
        is None
    )
    assert (
        callbacks.after_model(
            callback_context=SimpleNamespace(),
            llm_response=response,
        )
        is None
    )


def test_high_confidence_checker_exits_early() -> None:
    checker = LoopTerminationAgent(name="checker")
    context = SimpleNamespace(
        session=SimpleNamespace(
            state={"evaluation": EVALUATION, "loop_count": 0}
        )
    )

    async def collect_events():
        return [event async for event in checker._run_async_impl(context)]

    events = asyncio.run(collect_events())

    assert events[0].actions.escalate is True
    assert events[0].actions.state_delta["loop_count"] == 1


def test_low_confidence_checker_continues_loop() -> None:
    checker = LoopTerminationAgent(name="checker")
    evaluation = {**EVALUATION, "confidence": "low"}
    context = SimpleNamespace(
        session=SimpleNamespace(
            state={"evaluation": evaluation, "loop_count": 1}
        )
    )

    async def collect_events():
        return [event async for event in checker._run_async_impl(context)]

    events = asyncio.run(collect_events())

    assert events[0].actions.escalate is False
    assert events[0].actions.state_delta["loop_count"] == 2


def test_function_tools_reject_llm_supplied_scope_arguments() -> None:
    tools = _bound_tools()
    callbacks = _SafetyCallbacks(SecretScanner(), tools)
    function_tool = FunctionTool(tools.get_logs)

    result = callbacks.before_tool(
        function_tool,
        {"resource": "cloud_run/other", "filter": "severity>=DEFAULT"},
        SimpleNamespace(),
    )

    assert result == {"error": "tool arguments are not allowed"}
    assert callbacks.failed is True
