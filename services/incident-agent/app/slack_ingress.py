"""Public Slack Events ingress (I6 / docs/incident-agent.md §7-8, §7-12, §11).

Order of gates, all before any DB row or Cloud Task is created:
signature (+5min timestamp) → JSON shape → 3 allowlists (default-deny)
→ event_id idempotency → atomic per-user 1-minute rate → INSERT → enqueue → ACK.
Denials return a fixed 200 ACK so Slack does not amplify by retrying.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import time
from dataclasses import dataclass

from app.config import Settings
from app.db import Database
from app.dispatcher import AlreadyExistsError, TaskEnqueuer
from app.noise import IngestResult
from app.slack_events import SlackEventRequest, register_slack_event
from app.telemetry import record_slack_event_denied

MAX_SLACK_BODY_BYTES = 256 * 1024
SIGNATURE_TOLERANCE_SECONDS = 300

_EVENT_ID = re.compile(r"^Ev[A-Z0-9]{6,32}$")
_TEAM_ID = re.compile(r"^T[A-Z0-9]{4,32}$")
# Public (C) and private (G) channels only. DM (D) and MPIM are never valid (§11).
_CHANNEL_ID = re.compile(r"^[CG][A-Z0-9]{4,32}$")
_USER_ID = re.compile(r"^[UW][A-Z0-9]{4,32}$")
_THREAD_TS = re.compile(r"^\d{1,13}\.\d{1,6}$")

_ACK = IngestResult(200, {"ok": True})


def verify_slack_signature(
    *,
    raw_body: bytes,
    timestamp: str | None,
    signature: str | None,
    signing_secret: str,
    now: float | None = None,
) -> bool:
    """X-Slack-Signature v0 HMAC with a 5-minute replay window (§7-8)."""
    if not signing_secret or not timestamp or not signature:
        return False
    if not re.fullmatch(r"\d{1,13}", timestamp):
        return False
    current = now if now is not None else time.time()
    if abs(current - int(timestamp)) > SIGNATURE_TOLERANCE_SECONDS:
        return False
    base = b"v0:" + timestamp.encode("ascii") + b":" + raw_body
    expected = "v0=" + hmac.new(
        signing_secret.encode("utf-8"), base, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def slack_task_name(event_id: str) -> str:
    return f"slack-{event_id}"


@dataclass(frozen=True)
class _MentionEvent:
    event_id: str
    team_id: str
    channel_id: str
    thread_ts: str
    user_id: str


class SlackIngressService:
    def __init__(self, db: Database, settings: Settings, enqueuer: TaskEnqueuer):
        self._db = db
        self._settings = settings
        self._enqueuer = enqueuer

    def handle(
        self,
        raw_body: bytes,
        *,
        timestamp: str | None,
        signature: str | None,
    ) -> IngestResult:
        if len(raw_body) > MAX_SLACK_BODY_BYTES:
            return IngestResult(413, {"error": "payload too large"})
        if not verify_slack_signature(
            raw_body=raw_body,
            timestamp=timestamp,
            signature=signature,
            signing_secret=self._settings.slack_signing_secret,
        ):
            record_slack_event_denied("signature")
            return IngestResult(401, {"error": "invalid signature"})

        try:
            body = json.loads(raw_body)
        except ValueError:
            return IngestResult(400, {"error": "invalid json"})
        if not isinstance(body, dict):
            return IngestResult(400, {"error": "invalid json"})

        if body.get("type") == "url_verification":
            challenge = body.get("challenge")
            if not isinstance(challenge, str) or len(challenge) > 500:
                return IngestResult(400, {"error": "invalid challenge"})
            return IngestResult(200, {"challenge": challenge})

        event = body.get("event")
        if (
            body.get("type") != "event_callback"
            or not isinstance(event, dict)
            or event.get("type") != "app_mention"
        ):
            record_slack_event_denied("unsupported")
            return _ACK

        mention = self._extract_mention(body)
        if mention is None:
            record_slack_event_denied("malformed")
            return _ACK

        if not self._allowed(mention):
            record_slack_event_denied("allowlist")
            return _ACK

        outcome = register_slack_event(
            self._db,
            request=SlackEventRequest(
                event_id=mention.event_id,
                task_name=slack_task_name(mention.event_id),
                team_id=mention.team_id,
                channel_id=mention.channel_id,
                thread_ts=mention.thread_ts,
                user_id=mention.user_id,
            ),
            rate_limit_per_minute=self._settings.slack_user_rate_limit_per_minute,
        )
        if outcome == "rate_limited":
            record_slack_event_denied("rate_limited")
            return _ACK
        if outcome == "duplicate":
            return _ACK

        # registered / retry_enqueue: ACK only after the task exists (§7-8).
        try:
            self._enqueuer.enqueue(
                task_name=slack_task_name(mention.event_id),
                body={"event_id": mention.event_id},
            )
        except AlreadyExistsError:
            pass
        except Exception:
            # The row stays pending; Slack's retry re-enters the retry_enqueue path.
            return IngestResult(503, {"error": "task enqueue failed"})
        return _ACK

    @staticmethod
    def _extract_mention(body: dict) -> _MentionEvent | None:
        if body.get("type") != "event_callback":
            return None
        event = body.get("event")
        if not isinstance(event, dict) or event.get("type") != "app_mention":
            return None
        event_id = body.get("event_id")
        team_id = body.get("team_id")
        channel_id = event.get("channel")
        user_id = event.get("user")
        thread_ts = event.get("thread_ts") or event.get("ts")
        if (
            not isinstance(event_id, str)
            or not isinstance(team_id, str)
            or not isinstance(channel_id, str)
            or not isinstance(user_id, str)
            or not isinstance(thread_ts, str)
            or not _EVENT_ID.fullmatch(event_id)
            or not _TEAM_ID.fullmatch(team_id)
            or not _CHANNEL_ID.fullmatch(channel_id)
            or not _USER_ID.fullmatch(user_id)
            or not _THREAD_TS.fullmatch(thread_ts)
        ):
            return None
        return _MentionEvent(
            event_id=event_id,
            team_id=team_id,
            channel_id=channel_id,
            thread_ts=thread_ts,
            user_id=user_id,
        )

    def _allowed(self, mention: _MentionEvent) -> bool:
        """§7-8: all three allowlists must be configured and match (default-deny)."""
        teams = self._settings.allowed_slack_team_ids
        channels = self._settings.allowed_slack_channel_ids
        users = self._settings.allowed_slack_user_ids
        if not teams or not channels or not users:
            return False
        return (
            mention.team_id in teams
            and mention.channel_id in channels
            and mention.user_id in users
        )
