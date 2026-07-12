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
_GITHUB_ISSUE_PATH = re.compile(r"^/[^/]+/[^/]+/issues/\d+$")

_SEVERITY_DISPLAY = {
    "critical": ("🔴", "緊急"),
    "high": ("🟠", "高"),
    "medium": ("🟡", "中"),
    "low": ("🟢", "低"),
}
_CONFIDENCE_DISPLAY = {
    "high": "高",
    "medium": "中",
    "low": "低",
}


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

    def update(self, record: OutboxRecord) -> SlackReference:
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
    # Plain-text payloads ({"text": ...} with an optional discriminator "kind",
    # e.g. slack_followup) render as-is instead of falling through to JSON.
    if "text" in payload and not set(payload) - {"text", "kind"}:
        return str(payload["text"])
    alert = payload.get("alert")
    if isinstance(alert, dict):
        fields = ("resource", "service", "host", "message", "condition", "source_state")
        summary = [
            f"{field}: {alert[field]}"
            for field in fields
            if alert.get(field) is not None
        ]
        return "関連アラート:\n" + "\n".join(summary)
    sections: list[str] = []
    labels = (
        ("hypothesis", "仮説"),
        ("severity", "重大度"),
        ("confidence", "確信度"),
        ("playbook_used", "Playbook"),
        ("loop_count", "調査回数"),
        ("token_cost", "トークン数"),
    )
    for key, label in labels:
        if key in payload:
            sections.append(f"{label}: {payload[key]}")
    trace_line = (
        format_trace_line(payload.get("trace_url")) if include_trace else None
    )
    if trace_line:
        sections.append(trace_line)
    for key, label in (("evidence", "根拠"), ("recommended_actions", "推奨アクション")):
        value = payload.get(key)
        if isinstance(value, list):
            sections.append(f"{label}:\n" + "\n".join(f"- {item}" for item in value))
    if not sections:
        sections.append(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return "\n".join(sections)


def _plain_text(text: Any, *, limit: int = 3000) -> dict[str, Any]:
    return {
        "type": "plain_text",
        "text": str(text)[:limit] or "-",
        "emoji": True,
    }


def _list_text(value: Any, *, numbered: bool = False) -> str | None:
    if not isinstance(value, list):
        return None
    items = [str(item) for item in value if str(item).strip()]
    if not items:
        return None
    if numbered:
        return "\n".join(f"{index}. {item}" for index, item in enumerate(items, 1))
    return "\n".join(f"• {item}" for item in items)


def _allowed_action_url(value: Any, *, destination: str) -> str | None:
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    if destination == "trace" and format_trace_line(value):
        return value
    if (
        destination == "github"
        and parsed.scheme == "https"
        and parsed.netloc == "github.com"
        and _GITHUB_ISSUE_PATH.fullmatch(parsed.path)
        and not parsed.params
        and not parsed.query
        and not parsed.fragment
    ):
        return value
    return None


def _block_texts(value: Any):
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "text" and isinstance(child, str):
                yield child
            elif key != "url":
                yield from _block_texts(child)
    elif isinstance(value, list):
        for child in value:
            yield from _block_texts(child)


def render_slack_blocks(record: OutboxRecord) -> list[dict[str, Any]]:
    payload = record.payload
    if payload.get("kind") != "primary_investigation":
        return [
            {
                "type": "section",
                "text": _plain_text(render_analysis(payload)),
            }
        ]

    severity = str(payload.get("severity") or record.severity or "unknown").lower()
    severity_emoji, severity_label = _SEVERITY_DISPLAY.get(
        severity, ("⚪", severity)
    )
    confidence = str(payload.get("confidence") or "unknown").lower()
    confidence_label = _CONFIDENCE_DISPLAY.get(confidence, confidence)
    blocks: list[dict[str, Any]] = [
        {
            "type": "header",
            "text": _plain_text(
                f"{severity_emoji} インシデント一次切り分け完了",
                limit=150,
            ),
        },
        {
            "type": "context",
            "elements": [
                _plain_text(
                    f"対象: {record.resource}  |  アラート: {record.alert_policy}",
                    limit=2000,
                )
            ],
        },
        {
            "type": "section",
            "fields": [
                _plain_text(f"重大度\n{severity_emoji} {severity_label}"),
                _plain_text(f"確信度\n{confidence_label}"),
                _plain_text(f"調査回数\n{payload.get('loop_count', '-')} 回"),
                _plain_text(f"Playbook\n{payload.get('playbook_used', '-')}"),
            ],
        },
        {"type": "divider"},
    ]

    hypothesis = payload.get("hypothesis")
    if hypothesis:
        blocks.append(
            {
                "type": "section",
                "text": _plain_text(f"仮説\n{hypothesis}"),
            }
        )
    evidence = _list_text(payload.get("evidence"))
    if evidence:
        blocks.append(
            {
                "type": "section",
                "text": _plain_text(f"根拠\n{evidence}"),
            }
        )
    actions_text = _list_text(payload.get("recommended_actions"), numbered=True)
    if actions_text:
        blocks.append(
            {
                "type": "section",
                "text": _plain_text(f"推奨アクション\n{actions_text}"),
            }
        )

    action_elements: list[dict[str, Any]] = []
    issue_url = _allowed_action_url(record.github_issue, destination="github")
    if issue_url:
        action_elements.append(
            {
                "type": "button",
                "text": _plain_text("GitHub Issue を開く", limit=75),
                "url": issue_url,
                "action_id": "open_github_issue",
            }
        )
    trace_url = _allowed_action_url(payload.get("trace_url"), destination="trace")
    if trace_url:
        action_elements.append(
            {
                "type": "button",
                "text": _plain_text("Cloud Trace を開く", limit=75),
                "url": trace_url,
                "action_id": "open_cloud_trace",
            }
        )
    if action_elements:
        blocks.append({"type": "actions", "elements": action_elements})

    loop_count = payload.get("loop_count", "-")
    token_cost = payload.get("token_cost")
    cost_text = f"  |  {token_cost:g} tokens" if isinstance(token_cost, (int, float)) else ""
    blocks.append(
        {
            "type": "context",
            "elements": [
                _plain_text(
                    f"AI一次調査  |  {loop_count} ループ{cost_text}",
                    limit=2000,
                )
            ],
        }
    )
    return blocks


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

    def _message_content(
        self, record: OutboxRecord
    ) -> tuple[str, list[dict[str, Any]]]:
        text = render_analysis(record.payload)
        self._scanner.assert_safe(text)
        text = text[:3000]
        self._scanner.assert_safe(text)
        blocks = render_slack_blocks(record)
        for block_text in _block_texts(blocks):
            self._scanner.assert_safe(block_text)
        return text, blocks

    def send(self, record: OutboxRecord) -> SlackReference:
        text, blocks = self._message_content(record)
        body = {
            "channel": self._channel,
            "text": text,
            "parse": "none",
            "mrkdwn": False,
            "link_names": False,
            "unfurl_links": False,
            "unfurl_media": False,
            "client_msg_id": str(uuid5(NAMESPACE_URL, record.idempotency_key)),
            "blocks": blocks,
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

    def update(self, record: OutboxRecord) -> SlackReference:
        external_ref = record.dependency_external_ref
        if not isinstance(external_ref, str):
            raise ExternalDeliveryError("Slack update dependency missing reference")
        channel, separator, timestamp = external_ref.partition(":")
        if (
            not separator
            or channel != self._channel
            or not re.fullmatch(r"\d+\.\d+", timestamp)
        ):
            raise ExternalDeliveryError("Slack update dependency reference invalid")
        text, blocks = self._message_content(record)
        response = self._session.post(
            "https://slack.com/api/chat.update",
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            json={
                "channel": channel,
                "ts": timestamp,
                "text": text,
                "blocks": blocks,
                "parse": "none",
                "mrkdwn": False,
                "link_names": False,
                "unfurl_links": False,
                "unfurl_media": False,
            },
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("ok"):
            raise ExternalDeliveryError("Slack rejected message update")
        return SlackReference(team=self._team, channel=channel, thread=timestamp)


@dataclass(frozen=True)
class ThreadMessage:
    """One conversations.replies entry, before allowlist filtering."""

    user_id: str | None
    is_self_bot: bool
    text: str
    ts: str


class SlackThreadApiClient:
    """conversations.replies + threaded chat.postMessage for I6 (§11)."""

    def __init__(
        self,
        *,
        token: str,
        scanner: SecretScanner,
        session: requests.Session | None = None,
        history_limit: int = 50,
    ):
        if not token:
            raise ValueError("Slack bot token is required")
        self._token = token
        self._scanner = scanner
        self._session = session or requests.Session()
        self._history_limit = history_limit
        self._bot_user_id: str | None = None

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json; charset=utf-8",
        }

    def _self_bot_user_id(self) -> str:
        if self._bot_user_id is None:
            response = self._session.post(
                "https://slack.com/api/auth.test",
                headers=self._headers(),
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()
            if not payload.get("ok") or not isinstance(payload.get("user_id"), str):
                raise ExternalDeliveryError("Slack auth.test failed")
            self._bot_user_id = payload["user_id"]
        return self._bot_user_id

    def fetch_replies(self, *, channel: str, thread_ts: str) -> list[ThreadMessage]:
        bot_user = self._self_bot_user_id()
        response = self._session.get(
            "https://slack.com/api/conversations.replies",
            headers={"Authorization": f"Bearer {self._token}"},
            params={
                "channel": channel,
                "ts": thread_ts,
                "limit": self._history_limit,
            },
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("ok"):
            raise ExternalDeliveryError("Slack conversations.replies failed")
        messages = payload.get("messages")
        if not isinstance(messages, list):
            raise ExternalDeliveryError("invalid Slack replies response")
        result: list[ThreadMessage] = []
        for message in messages[: self._history_limit]:
            if not isinstance(message, dict):
                continue
            text = message.get("text")
            ts = message.get("ts")
            if not isinstance(text, str) or not isinstance(ts, str):
                continue
            user = message.get("user")
            user_id = user if isinstance(user, str) else None
            result.append(
                ThreadMessage(
                    user_id=user_id,
                    is_self_bot=user_id == bot_user,
                    text=text,
                    ts=ts,
                )
            )
        return result

    def post_reply(
        self,
        *,
        channel: str,
        thread_ts: str,
        text: str,
        client_msg_id: str,
    ) -> str:
        self._scanner.assert_safe(text)
        text = text[:3000]
        self._scanner.assert_safe(text)
        body = {
            "channel": channel,
            "thread_ts": thread_ts,
            "text": text,
            "mrkdwn": False,
            "link_names": False,
            "unfurl_links": False,
            "unfurl_media": False,
            "client_msg_id": str(uuid5(NAMESPACE_URL, client_msg_id)),
            "blocks": [
                {
                    "type": "section",
                    "text": {"type": "plain_text", "text": text, "emoji": False},
                }
            ],
        }
        response = self._session.post(
            "https://slack.com/api/chat.postMessage",
            headers=self._headers(),
            json=body,
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("ok"):
            raise ExternalDeliveryError("Slack rejected thread reply")
        timestamp = payload.get("ts")
        if not isinstance(timestamp, str):
            raise ExternalDeliveryError("Slack reply response missing ts")
        return timestamp


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
