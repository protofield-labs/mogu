from __future__ import annotations

from dataclasses import dataclass
import json
import re
from typing import Any, Protocol
from urllib.parse import urlparse
from uuid import NAMESPACE_URL, uuid5

import requests

from agent.scanner import SecretScanner
from app.outbox import OutboxRecord

_URL = re.compile(r"https?://[^\s<>()]+", re.IGNORECASE)
_MARKDOWN_SPECIAL = re.compile(r"([\\`*_{}\[\]()#+.!|>~-])")


class ExternalDeliveryError(Exception):
    """A retryable or terminal external API delivery failure."""


@dataclass(frozen=True)
class SlackReference:
    team: str
    channel: str
    thread: str

    @property
    def external_ref(self) -> str:
        return f"{self.channel}:{self.thread}"


class SlackSender(Protocol):
    def send(self, record: OutboxRecord) -> SlackReference:
        ...


class GitHubSender(Protocol):
    def send(self, record: OutboxRecord) -> str:
        ...


def safe_markdown_text(value: Any) -> str:
    text = str(value)
    text = _URL.sub("[LINK REMOVED]", text)
    text = text.replace("@", "@\u200b")
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return _MARKDOWN_SPECIAL.sub(r"\\\1", text)


def format_trace_line(trace_url: Any) -> str | None:
    if not isinstance(trace_url, str):
        return None
    parsed = urlparse(trace_url)
    if (
        parsed.scheme == "https"
        and parsed.netloc == "console.cloud.google.com"
        and parsed.path.startswith("/traces/")
    ):
        return f"Trace: {trace_url}"
    return None


def render_analysis(payload: dict[str, Any], *, include_trace: bool = True) -> str:
    if set(payload) == {"text"}:
        return str(payload["text"])
    alert = payload.get("alert")
    if isinstance(alert, dict):
        fields = ("resource", "service", "host", "message", "condition", "source_state")
        summary = [
            f"{field}: {alert[field]}"
            for field in fields
            if alert.get(field) is not None
        ]
        return "Related alert:\n" + "\n".join(summary)
    sections: list[str] = []
    labels = (
        ("hypothesis", "Hypothesis"),
        ("severity", "Severity"),
        ("confidence", "Confidence"),
        ("playbook_used", "Playbook"),
        ("loop_count", "Loop count"),
        ("token_cost", "Token cost"),
    )
    for key, label in labels:
        if key in payload:
            sections.append(f"{label}: {payload[key]}")
    trace_line = (
        format_trace_line(payload.get("trace_url")) if include_trace else None
    )
    if trace_line:
        sections.append(trace_line)
    for key, label in (("evidence", "Evidence"), ("recommended_actions", "Actions")):
        value = payload.get(key)
        if isinstance(value, list):
            sections.append(f"{label}:\n" + "\n".join(f"- {item}" for item in value))
    if not sections:
        sections.append(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return "\n".join(sections)


class SlackApiSender:
    def __init__(
        self,
        *,
        token: str,
        channel: str,
        team: str,
        scanner: SecretScanner,
        session: requests.Session | None = None,
    ):
        if not token or not channel or not team:
            raise ValueError("Slack token, channel, and team are required")
        self._token = token
        self._channel = channel
        self._team = team
        self._scanner = scanner
        self._session = session or requests.Session()

    def send(self, record: OutboxRecord) -> SlackReference:
        text = render_analysis(record.payload)
        self._scanner.assert_safe(text)
        text = text[:3000]
        self._scanner.assert_safe(text)
        body = {
            "channel": self._channel,
            "text": text,
            "mrkdwn": False,
            "link_names": False,
            "unfurl_links": False,
            "unfurl_media": False,
            "client_msg_id": str(uuid5(NAMESPACE_URL, record.idempotency_key)),
            "blocks": [
                {
                    "type": "section",
                    "text": {"type": "plain_text", "text": text, "emoji": False},
                }
            ],
        }
        response = self._session.post(
            "https://slack.com/api/chat.postMessage",
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            json=body,
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("ok"):
            raise ExternalDeliveryError("Slack rejected message")
        channel = payload.get("channel")
        timestamp = payload.get("ts")
        if not isinstance(channel, str) or not isinstance(timestamp, str):
            raise ExternalDeliveryError("Slack response missing reference")
        return SlackReference(team=self._team, channel=channel, thread=timestamp)


class GitHubApiSender:
    def __init__(
        self,
        *,
        token: str,
        repository: str,
        scanner: SecretScanner,
        session: requests.Session | None = None,
    ):
        if not token or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
            raise ValueError("valid GitHub token and owner/repository are required")
        self._repository = repository
        self._base = f"https://api.github.com/repos/{repository}"
        self._scanner = scanner
        self._session = session or requests.Session()
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def send(self, record: OutboxRecord) -> str:
        if record.destination == "github_issue":
            return self._ensure_issue(record)
        if record.destination == "github_comment":
            issue_number = self._issue_number(record.github_issue)
            return self._ensure_comment(record, issue_number)
        if record.destination == "github_close":
            issue_number = self._issue_number(record.github_issue)
            return self._close_issue(issue_number)
        raise ExternalDeliveryError("unsupported GitHub destination")

    def _ensure_issue(self, record: OutboxRecord) -> str:
        marker = self._marker(record)
        existing = self._find_issue(marker)
        if existing:
            return existing
        title = safe_markdown_text(
            f"[Incident] {record.resource} — {record.severity or 'unknown'}"
        )[:256]
        body = self._issue_body(record, marker)
        response = self._session.post(
            f"{self._base}/issues",
            headers=self._headers,
            json={"title": title, "body": body},
            timeout=20,
        )
        response.raise_for_status()
        url = response.json().get("html_url")
        if not isinstance(url, str):
            raise ExternalDeliveryError("GitHub issue response missing URL")
        return self._canonical_issue_url(url)

    def _ensure_comment(self, record: OutboxRecord, issue_number: int) -> str:
        marker = self._marker(record)
        for page in range(1, 101):
            response = self._session.get(
                f"{self._base}/issues/{issue_number}/comments",
                headers=self._headers,
                params={"per_page": 100, "page": page},
                timeout=20,
            )
            response.raise_for_status()
            comments = response.json()
            if not isinstance(comments, list):
                raise ExternalDeliveryError("invalid GitHub comments response")
            for comment in comments:
                if marker in str(comment.get("body", "")):
                    url = comment.get("html_url")
                    if isinstance(url, str):
                        return self._validated_comment_url(url, issue_number)
            if len(comments) < 100:
                break
        content = safe_markdown_text(render_analysis(record.payload))
        if record.payload.get("kind") == "storm_merge":
            storm_number = self._issue_number(record.dependency_external_ref)
            content += (
                f"\n\nStorm issue: "
                f"https://github.com/{self._repository}/issues/{storm_number}"
            )
        body = f"{content}\n\n{marker}"
        self._scanner.assert_safe(body)
        response = self._session.post(
            f"{self._base}/issues/{issue_number}/comments",
            headers=self._headers,
            json={"body": body},
            timeout=20,
        )
        response.raise_for_status()
        url = response.json().get("html_url")
        if not isinstance(url, str):
            raise ExternalDeliveryError("GitHub comment response missing URL")
        return self._validated_comment_url(url, issue_number)

    def _close_issue(self, issue_number: int) -> str:
        response = self._session.patch(
            f"{self._base}/issues/{issue_number}",
            headers=self._headers,
            json={"state": "closed"},
            timeout=20,
        )
        response.raise_for_status()
        url = response.json().get("html_url")
        if not isinstance(url, str):
            raise ExternalDeliveryError("GitHub close response missing URL")
        return self._canonical_issue_url(url)

    def _find_issue(self, marker: str) -> str | None:
        for page in range(1, 101):
            response = self._session.get(
                f"{self._base}/issues",
                headers=self._headers,
                params={"state": "all", "per_page": 100, "page": page},
                timeout=20,
            )
            response.raise_for_status()
            issues = response.json()
            if not isinstance(issues, list):
                raise ExternalDeliveryError("invalid GitHub issues response")
            for issue in issues:
                if "pull_request" not in issue and marker in str(issue.get("body", "")):
                    url = issue.get("html_url")
                    if isinstance(url, str):
                        return self._canonical_issue_url(url)
            if len(issues) < 100:
                break
        return None

    def _issue_body(self, record: OutboxRecord, marker: str) -> str:
        base_payload = {
            key: value
            for key, value in record.payload.items()
            if key != "trace_url"
        }
        content = safe_markdown_text(
            render_analysis(base_payload, include_trace=False)
        )
        trace_line = format_trace_line(record.payload.get("trace_url"))
        if trace_line:
            content += f"\n{trace_line}"
        body = (
            f"## Automated investigation\n\n{content}\n\n"
            f"Resource: `{safe_markdown_text(record.resource)}`  \n"
            f"Alert policy: `{safe_markdown_text(record.alert_policy)}`\n\n{marker}"
        )
        self._scanner.assert_safe(body)
        return body

    def _issue_number(self, issue_url: str | None) -> int:
        if not issue_url:
            raise ExternalDeliveryError("incident has no GitHub issue reference")
        parsed = urlparse(issue_url)
        expected_path = f"/{self._repository}/issues/"
        if parsed.scheme != "https" or parsed.netloc != "github.com":
            raise ExternalDeliveryError("GitHub issue reference is outside configured repository")
        if not parsed.path.startswith(expected_path):
            raise ExternalDeliveryError("GitHub issue reference repository mismatch")
        number = parsed.path.removeprefix(expected_path)
        if not number.isdigit() or int(number) <= 0:
            raise ExternalDeliveryError("invalid GitHub issue reference")
        return int(number)

    def _canonical_issue_url(self, issue_url: str) -> str:
        number = self._issue_number(issue_url)
        return f"https://github.com/{self._repository}/issues/{number}"

    def _validated_comment_url(self, comment_url: str, issue_number: int) -> str:
        parsed = urlparse(comment_url)
        expected_path = f"/{self._repository}/issues/{issue_number}"
        if (
            parsed.scheme != "https"
            or parsed.netloc != "github.com"
            or parsed.path != expected_path
            or not parsed.fragment.startswith("issuecomment-")
        ):
            raise ExternalDeliveryError("invalid GitHub comment reference")
        return (
            f"https://github.com/{self._repository}/issues/{issue_number}"
            f"#{parsed.fragment}"
        )

    @staticmethod
    def _marker(record: OutboxRecord) -> str:
        safe_key = re.sub(r"[^A-Za-z0-9:_.-]", "_", record.idempotency_key)
        chunked_key = ".".join(
            safe_key[index : index + 8] for index in range(0, len(safe_key), 8)
        )
        return f"<!-- incident-agent:{chunked_key} -->"
