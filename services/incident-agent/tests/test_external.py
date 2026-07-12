from __future__ import annotations

from uuid import UUID

from agent.scanner import SecretScanner
from app.external import GitHubApiSender, SlackApiSender, render_analysis, safe_markdown_text
from app.outbox import OutboxRecord


class FakeResponse:
    def __init__(self, payload, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("http error")

    def json(self):
        return self._payload


class FakeSession:
    def __init__(self):
        self.calls = []
        self.issues = []
        self.comments = []

    def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        if url.endswith("/comments"):
            return FakeResponse(self.comments)
        return FakeResponse(self.issues)

    def post(self, url, **kwargs):
        self.calls.append(("POST", url, kwargs))
        if "slack.com" in url:
            return FakeResponse({"ok": True, "channel": "C123", "ts": "1234.5678"})
        if url.endswith("/comments"):
            return FakeResponse(
                {"html_url": "https://github.com/acme/repo/issues/9#issuecomment-1"}
            )
        return FakeResponse({"html_url": "https://github.com/acme/repo/issues/9"})

    def patch(self, url, **kwargs):
        self.calls.append(("PATCH", url, kwargs))
        return FakeResponse({"html_url": "https://github.com/acme/repo/issues/9"})


def _record(destination: str, **overrides) -> OutboxRecord:
    values = dict(
        id=UUID("11111111-2222-4333-8444-555555555555"),
        incident_id=UUID("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"),
        destination=destination,
        idempotency_key=f"{destination}:incident-1",
        depends_on=None,
        dependency_external_ref=None,
        dispatch_generation=0,
        payload={
            "hypothesis": "revision regression",
            "evidence": ["latency increased"],
            "severity": "high",
            "recommended_actions": ["rollback after human approval"],
            "confidence": "high",
        },
        attempt_count=1,
        delivery_token=UUID("99999999-8888-4777-8666-555555555555"),
        incident_status="analyzed",
        incident_kind="normal",
        resource="cloud_run/dev-web",
        alert_policy="dev-web-latency",
        severity="high",
        github_issue=None,
    )
    values.update(overrides)
    return OutboxRecord(**values)


def test_render_analysis_renders_kinded_text_payload_as_plain_text() -> None:
    text = render_analysis(
        {"kind": "slack_followup", "text": "Slack follow-up finding:\nanswer"}
    )
    assert text == "Slack follow-up finding:\nanswer"
    assert "{" not in text


def test_render_analysis_includes_trace_url() -> None:
    text = render_analysis(
        {
            "hypothesis": "latency regression",
            "trace_url": "https://console.cloud.google.com/traces/explorer;traceId=abc",
        }
    )
    assert "Trace: https://console.cloud.google.com/traces/explorer;traceId=abc" in text


def test_slack_includes_trace_link_in_plain_text() -> None:
    session = FakeSession()
    sender = SlackApiSender(
        token="not-a-secret-fixture",
        channel="C123",
        team="T123",
        scanner=SecretScanner(),
        session=session,
    )
    record = _record(
        "slack",
        payload={
            "hypothesis": "latency regression",
            "trace_url": (
                "https://console.cloud.google.com/traces/explorer;traceId=abc"
                "?project=mogu-501309"
            ),
        },
    )

    sender.send(record)

    text = session.calls[0][2]["json"]["blocks"][0]["text"]["text"]
    assert "Trace:" in text
    assert "console.cloud.google.com/traces/explorer" in text


def test_github_issue_body_includes_trace_link() -> None:
    session = FakeSession()
    sender = GitHubApiSender(
        token="not-a-secret-fixture",
        repository="acme/repo",
        scanner=SecretScanner(),
        session=session,
    )
    record = _record(
        "github_issue",
        payload={
            "hypothesis": "latency regression",
            "trace_url": (
                "https://console.cloud.google.com/traces/explorer;traceId=abc"
                "?project=mogu-501309"
            ),
        },
    )

    sender.send(record)

    body = session.calls[-1][2]["json"]["body"]
    assert "Trace:" in body
    assert "console.cloud.google.com/traces/explorer" in body


def test_slack_uses_plain_text_and_deterministic_client_message_id() -> None:
    session = FakeSession()
    sender = SlackApiSender(
        token="not-a-secret-fixture",
        channel="C123",
        team="T123",
        scanner=SecretScanner(),
        session=session,
    )
    record = _record(
        "slack",
        payload={"text": "<!here> investigate <@U123> & confirm"},
    )

    result = sender.send(record)

    body = session.calls[0][2]["json"]
    assert body["blocks"][0]["text"]["type"] == "plain_text"
    assert body["blocks"][0]["text"]["text"] == "<!here> investigate <@U123> & confirm"
    assert body["client_msg_id"] == "fccb9a78-e902-5839-8adc-d3efc5a68b1f"
    assert result.team == "T123"
    assert result.external_ref == "C123:1234.5678"


def test_github_issue_reuses_marker_before_creating() -> None:
    session = FakeSession()
    sender = GitHubApiSender(
        token="not-a-secret-fixture",
        repository="acme/repo",
        scanner=SecretScanner(),
        session=session,
    )
    record = _record("github_issue")
    marker = sender._marker(record)
    session.issues = [
        {
            "body": f"existing\n{marker}",
            "html_url": "https://github.com/acme/repo/issues/9",
        }
    ]

    url = sender.send(record)

    assert url.endswith("/issues/9")
    assert [call[0] for call in session.calls] == ["GET"]


def test_storm_comment_waits_for_dependency_reference_and_then_closes() -> None:
    session = FakeSession()
    sender = GitHubApiSender(
        token="not-a-secret-fixture",
        repository="acme/repo",
        scanner=SecretScanner(),
        session=session,
    )
    comment = _record(
        "github_comment",
        payload={"kind": "storm_merge", "text": "Consolidated into storm."},
        github_issue="https://github.com/acme/repo/issues/9",
        dependency_external_ref="https://github.com/acme/repo/issues/10",
    )

    sender.send(comment)
    posted_body = session.calls[-1][2]["json"]["body"]
    assert "https://github.com/acme/repo/issues/10" in posted_body

    close = _record(
        "github_close",
        github_issue="https://github.com/acme/repo/issues/9",
    )
    sender.send(close)
    assert session.calls[-1][0] == "PATCH"
    assert session.calls[-1][2]["json"] == {"state": "closed"}


def test_github_markdown_neutralizes_mentions_html_and_unknown_links() -> None:
    rendered = safe_markdown_text("@here <b>x</b> https://evil.example/path")
    assert "@\u200bhere" in rendered
    assert "&lt;b&gt;" in rendered
    assert "\\[LINK REMOVED\\]" in rendered
