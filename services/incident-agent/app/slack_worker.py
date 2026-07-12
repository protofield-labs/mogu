"""Slack follow-up worker (I6 / docs/incident-agent.md §7-8, §11).

The Cloud Task body carries only event_id. Every authorization input —
team/channel/thread/user, incident linkage, task name — is re-read from
ops.slack_events and ops.incidents (DB as the single source of truth).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Protocol

from agent.scanner import SecretScanError, SecretScanner
from agent.tools import (
    BoundInvestigationTools,
    GoogleObservationClient,
    IncidentToolScope,
    ObservationClient,
    ToolScopeError,
)
from app.config import Settings
from app.db import Database
from app.external import ThreadMessage
from app.followup import FollowupOutput, FollowupRequest, FollowupRuntime
from app.slack_events import (
    FollowupIncident,
    SlackEventRow,
    claim_slack_event,
    complete_slack_event,
    count_thread_events_last_hour,
    load_slack_event,
    lookup_incident_for_thread,
    release_slack_event,
    reserve_followup_budget,
    save_followup_comment_and_complete,
)
from app.telemetry import record_followup_completed
from app.worker import WorkerResult

logger = logging.getLogger(__name__)

FIXED_UNLINKED_REPLY = (
    "This thread is not linked to an active incident with a GitHub issue, "
    "so no follow-up investigation was run."
)
FIXED_LIMIT_REPLY = (
    "Follow-up investigation is currently limited by budget or rate controls. "
    "Please retry later."
)
FIXED_SAFETY_REPLY = (
    "Follow-up investigation was stopped because its content could not be "
    "sanitized safely. Manual review required."
)
FIXED_FAILURE_REPLY = (
    "Follow-up investigation failed after multiple attempts. "
    "Please check the GitHub issue or mention the bot again later."
)


class SlackThreadGateway(Protocol):
    def fetch_replies(self, *, channel: str, thread_ts: str) -> list[ThreadMessage]:
        ...

    def post_reply(
        self, *, channel: str, thread_ts: str, text: str, client_msg_id: str
    ) -> str:
        ...


class SlackFollowupWorker:
    def __init__(
        self,
        db: Database,
        settings: Settings,
        *,
        gateway: SlackThreadGateway,
        runtime: FollowupRuntime,
        scanner: SecretScanner,
        observation_client: ObservationClient | None = None,
    ):
        self._db = db
        self._settings = settings
        self._gateway = gateway
        self._runtime = runtime
        self._scanner = scanner
        self._observation_client = observation_client

    async def handle(self, event_id: str, *, task_name: str | None) -> WorkerResult:
        row = load_slack_event(self._db, event_id)
        if row is None:
            # Fail-closed: never act on an event the DB has not registered.
            return WorkerResult(200, {"status": "unknown_event"})
        if task_name and task_name.rsplit("/", 1)[-1] != row.task_name:
            return WorkerResult(200, {"status": "task_name_mismatch"})

        incident = lookup_incident_for_thread(
            self._db,
            team_id=row.team_id,
            channel_id=row.channel_id,
            thread_ts=row.thread_ts,
        )
        outcome, claimed = claim_slack_event(
            self._db,
            event_id=event_id,
            lease_seconds=self._settings.slack_lease_seconds,
            incident_id=incident.id if incident else None,
        )
        if outcome == "busy":
            return WorkerResult(503, {"error": "slack event already leased"})
        if outcome == "incident_busy":
            # §11: one follow-up per incident at a time; the task retries later.
            return WorkerResult(503, {"error": "incident follow-up in progress"})
        if outcome in ("completed", "failed"):
            return WorkerResult(200, {"status": f"already_{outcome}"})
        if outcome == "exhausted":
            # Just transitioned to failed: ingress already ACKed the mention,
            # so tell the thread the investigation gave up (§11, best effort).
            if claimed is not None:
                self._post_failure_notice(claimed)
            return WorkerResult(200, {"status": "failed"})
        if outcome == "missing" or claimed is None:
            return WorkerResult(200, {"status": "unknown_event"})

        try:
            return await self._process(claimed, incident)
        except SecretScanError:
            return self._finish_fixed(claimed, FIXED_SAFETY_REPLY, "safety_rejected")
        except Exception:
            state = release_slack_event(self._db, event_id=event_id)
            if state == "failed":
                self._post_failure_notice(claimed)
                return WorkerResult(200, {"status": "failed"})
            return WorkerResult(
                503, {"error": "follow-up execution failed", "state": state}
            )

    async def _process(
        self,
        event: SlackEventRow,
        incident: FollowupIncident | None,
    ) -> WorkerResult:
        # §7-8: the worker re-validates every allowlist the ingress checked.
        if not self._allowlisted(event):
            complete_slack_event(self._db, event_id=event.event_id)
            return WorkerResult(200, {"status": "denied"})

        # §11: known + unresolved + issue-linked threads only (4 refs required).
        if (
            incident is None
            or not incident.github_issue
            or incident.issue_outbox_id is None
        ):
            return self._finish_fixed(event, FIXED_UNLINKED_REPLY, "not_linked")

        if incident.resource not in self._settings.allowed_resources:
            complete_slack_event(self._db, event_id=event.event_id)
            return WorkerResult(200, {"status": "denied"})

        limit = self._settings.slack_thread_rate_limit_per_hour
        recent = count_thread_events_last_hour(
            self._db,
            team_id=event.team_id,
            channel_id=event.channel_id,
            thread_ts=event.thread_ts,
            user_id=event.user_id,
        )
        if limit <= 0 or recent > limit:
            return self._finish_fixed(event, FIXED_LIMIT_REPLY, "thread_rate_limited")

        # Fetch and sanitize the thread first so pre-LLM failures (Slack API,
        # secret scan) never consume the shared budget (§11: reserve
        # investigation_count immediately before the LLM run).
        thread_context = self._filtered_thread_context(event)

        if not reserve_followup_budget(
            self._db,
            event_id=event.event_id,
            max_budget=self._settings.max_investigation_budget,
        ):
            return self._finish_fixed(event, FIXED_LIMIT_REPLY, "budget_exceeded")

        answer = await self._investigate(event, incident, thread_context)

        reply_text = _render_reply(answer)
        self._scanner.assert_safe(reply_text)
        comment_payload = self._scanner.sanitize_payload(
            {
                "kind": "slack_followup",
                "text": f"Slack follow-up finding:\n{reply_text}",
            }
        )

        # Persist the durable record (issue comment outbox + completion) before
        # the interactive reply, so a Slack failure cannot trigger a full retry
        # that reruns the LLM and charges the budget again. GitHub Issue is the
        # record of truth (§10); the finding still reaches operators via outbox.
        try:
            saved = save_followup_comment_and_complete(
                self._db,
                event_id=event.event_id,
                incident_id=incident.id,
                issue_outbox_id=incident.issue_outbox_id,
                payload=comment_payload,
            )
        except Exception:
            # DB failure after the LLM ran: hold the lease instead of releasing,
            # so Cloud Tasks retries hit "busy" (503) without a second model run
            # until the lease expires. Only then may a fresh attempt (max 3,
            # budget-gated) rebuild the lost answer.
            logger.warning(
                "durable completion failed; holding lease to damp LLM reruns",
                exc_info=True,
            )
            return WorkerResult(503, {"error": "durable completion failed"})
        if not saved:
            return WorkerResult(200, {"status": "stale_event_completed"})

        try:
            self._gateway.post_reply(
                channel=event.channel_id,
                thread_ts=event.thread_ts,
                text=reply_text,
                client_msg_id=f"slack-followup:{event.event_id}",
            )
        except Exception:
            logger.warning("slack thread reply failed after durable completion")
            return WorkerResult(200, {"status": "comment_saved_reply_failed"})
        record_followup_completed()
        return WorkerResult(200, {"status": "replied"})

    async def _investigate(
        self,
        event: SlackEventRow,
        incident: FollowupIncident,
        thread_context: list[dict[str, str]],
    ) -> FollowupOutput:
        try:
            observation = self._observation_client or GoogleObservationClient(
                self._settings.google_cloud_project
            )
            tools = BoundInvestigationTools(
                self._db,
                IncidentToolScope(
                    incident_id=incident.id,
                    project_id=self._settings.google_cloud_project,
                    resource=incident.resource,
                    alert_policy=incident.alert_policy,
                    embedding=incident.embedding or [],
                ),
                observation,
                self._scanner,
            )
        except ToolScopeError as exc:
            raise SecretScanError("follow-up tool scope invalid") from exc

        summary = self._scanner.sanitize_text(incident.rca_hypothesis or "")[:2000]
        budget = float(self._settings.absolute_deadline_seconds)
        budget = max(0.0, min(270.0, budget - 30.0))
        if budget <= 0:
            raise RuntimeError("insufficient follow-up budget")
        return await asyncio.wait_for(
            self._runtime.run(
                FollowupRequest(
                    incident_id=str(incident.id),
                    incident_summary=summary,
                    thread_context=thread_context,
                    loop_budget_seconds=budget,
                ),
                tools,
                self._scanner,
            ),
            timeout=budget,
        )

    def _filtered_thread_context(self, event: SlackEventRow) -> list[dict[str, str]]:
        """§11: only allowlisted operators and the bot's own replies reach the LLM."""
        messages = self._gateway.fetch_replies(
            channel=event.channel_id,
            thread_ts=event.thread_ts,
        )
        allowed_users = self._settings.allowed_slack_user_ids
        context: list[dict[str, str]] = []
        for message in messages:
            if message.is_self_bot:
                author = "incident-agent"
            elif message.user_id and message.user_id in allowed_users:
                author = "operator"
            else:
                continue
            # §7-10: scanner failure on any included message fails the event closed.
            text = self._scanner.sanitize_text(message.text)[:2000]
            context.append({"author": author, "text": text})
        return context

    def _allowlisted(self, event: SlackEventRow) -> bool:
        teams = self._settings.allowed_slack_team_ids
        channels = self._settings.allowed_slack_channel_ids
        users = self._settings.allowed_slack_user_ids
        if not teams or not channels or not users:
            return False
        return (
            event.team_id in teams
            and event.channel_id in channels
            and event.user_id in users
        )

    def _post_failure_notice(self, event: SlackEventRow) -> None:
        """Best-effort notice for a permanently failed event; never retried."""
        try:
            self._gateway.post_reply(
                channel=event.channel_id,
                thread_ts=event.thread_ts,
                text=FIXED_FAILURE_REPLY,
                client_msg_id=f"slack-followup-failed:{event.event_id}",
            )
        except Exception:
            logger.warning("failure notice delivery failed")

    def _finish_fixed(
        self,
        event: SlackEventRow,
        reply: str,
        status: str,
    ) -> WorkerResult:
        """Post a fixed constant reply and complete the event (§11)."""
        try:
            self._gateway.post_reply(
                channel=event.channel_id,
                thread_ts=event.thread_ts,
                text=reply,
                client_msg_id=f"slack-followup:{event.event_id}",
            )
        except Exception:
            state = release_slack_event(self._db, event_id=event.event_id)
            return WorkerResult(
                503, {"error": "fixed reply delivery failed", "state": state}
            )
        complete_slack_event(self._db, event_id=event.event_id)
        return WorkerResult(200, {"status": status})


def _render_reply(answer: FollowupOutput) -> str:
    sections = [answer.answer]
    if answer.evidence:
        sections.append(
            "Evidence:\n" + "\n".join(f"- {item}" for item in answer.evidence)
        )
    return "\n".join(sections)
