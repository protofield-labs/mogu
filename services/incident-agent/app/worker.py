from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from agent.scanner import SecretScanError, SecretScanner
from app.db import Database
from app.external import GitHubSender, SlackReference, SlackSender, render_analysis
from app.outbox import (
    ClaimResult,
    ReferenceConflictError,
    claim_outbox,
    fail_outbox_safety,
    mark_outbox_sent,
    release_or_fail_outbox,
)


@dataclass(frozen=True)
class WorkerResult:
    status_code: int
    body: dict[str, str]


class OutboxWorker:
    def __init__(
        self,
        db: Database,
        *,
        slack: SlackSender,
        github: GitHubSender,
        scanner: SecretScanner,
        lease_seconds: int = 300,
    ):
        self._db = db
        self._slack = slack
        self._github = github
        self._scanner = scanner
        self._lease_seconds = lease_seconds

    def handle(self, outbox_id: UUID) -> WorkerResult:
        claim = claim_outbox(
            self._db,
            outbox_id=outbox_id,
            lease_seconds=self._lease_seconds,
        )
        terminal = self._terminal_claim_result(claim)
        if terminal is not None:
            return terminal
        assert claim.record is not None
        record = claim.record
        try:
            # Final fail-closed boundary immediately before external I/O.
            self._scanner.assert_safe(render_analysis(record.payload))
            slack_ref: SlackReference | None = None
            if record.destination == "slack":
                slack_ref = self._slack.send(record)
                external_ref = slack_ref.external_ref
            elif record.destination in {
                "github_issue",
                "github_comment",
                "github_close",
            }:
                external_ref = self._github.send(record)
            else:
                raise ValueError("unsupported outbox destination")
            self._scanner.assert_safe(external_ref)
            saved = mark_outbox_sent(
                self._db,
                record=record,
                external_ref=external_ref,
                slack_team=slack_ref.team if slack_ref else None,
                slack_channel=slack_ref.channel if slack_ref else None,
                slack_thread=slack_ref.thread if slack_ref else None,
            )
            if not saved:
                # Another invocation already replaced this delivery token. Its
                # DB-authoritative claim will reconcile the idempotent external
                # operation; the stale Cloud Task must stop retrying.
                return WorkerResult(200, {"status": "stale_delivery_completed"})
            return WorkerResult(200, {"status": "sent", "outbox_id": str(record.id)})
        except SecretScanError:
            failed = fail_outbox_safety(self._db, record=record)
            return WorkerResult(
                200 if failed else 503,
                {
                    "error": "outbox rejected by safety policy",
                    "state": "failed" if failed else "stale",
                },
            )
        except ReferenceConflictError:
            # External delivery succeeded but the incident row already holds a
            # different reference. Retrying cannot reconcile that, so fail the
            # row permanently (operator replay) instead of burning retries.
            failed = fail_outbox_safety(self._db, record=record)
            return WorkerResult(
                200 if failed else 503,
                {
                    "error": "incident external reference conflict",
                    "state": "failed" if failed else "stale",
                },
            )
        except Exception:
            state = release_or_fail_outbox(self._db, record=record)
            return WorkerResult(
                503,
                {"error": "external delivery failed", "state": state},
            )

    @staticmethod
    def _terminal_claim_result(claim: ClaimResult) -> WorkerResult | None:
        if claim.state == "claimed":
            return None
        if claim.state == "sent":
            return WorkerResult(200, {"status": "already_sent"})
        if claim.state == "failed":
            return WorkerResult(200, {"status": "failed_requires_replay"})
        if claim.state == "missing":
            return WorkerResult(404, {"error": "outbox not found"})
        if claim.state == "blocked":
            return WorkerResult(503, {"error": "outbox dependency not sent"})
        return WorkerResult(503, {"error": "outbox delivery already leased"})
