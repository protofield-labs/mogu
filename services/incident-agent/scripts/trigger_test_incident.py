#!/usr/bin/env python3
"""Trigger a synthetic incident end-to-end for local demos (ingest → investigation → I6).

Uses fake LLM runtimes so Vertex credentials are not required. Prints each stage
to stdout; Slack/GitHub/Cloud Tasks are stubbed (no network I/O).

Usage:
  cd services/incident-agent
  python -m scripts.trigger_test_incident
  python -m scripts.trigger_test_incident --no-bootstrap   # reuse existing DB

Requires Docker when bootstrap is enabled (default). Uses localhost:54329 by
default so a local Postgres on 5432 is not disturbed.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import subprocess
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# scripts/ is not on sys.path by default when invoked as -m scripts.trigger_test_incident
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from agent.runtime import AnalysisResult
from agent.scanner import SecretScanner
from agent.service import InvestigationService
from app.config import Settings
from app.db import Database
from app.deadline import RequestDeadline
from app.embedding import DeterministicEmbeddingClient
from app.followup import FollowupOutput
from app.ingest import IngestService
from app.noise import InvestigationReady
from app.slack_events import SlackEventRequest, register_slack_event
from app.slack_worker import SlackFollowupWorker
from app.worker import OutboxWorker

DEFAULT_DB_PORT = "54329"
DEMO_CONTAINER = "mogu-incident-agent-demo-pg"

DEMO_TEAM = "T0123456"
DEMO_CHANNEL = "C0123456"
DEMO_USER = "U0123456"
DEMO_THREAD = "1719999999.000100"


@dataclass(frozen=True)
class FakeSlackRef:
    team: str
    channel: str
    thread: str
    external_ref: str


class DemoPrimaryRuntime:
    async def run(self, request, tools, scanner):
        return AnalysisResult(
            hypothesis="demo: p99 latency doubled after revision dev-web-00099 rollout",
            evidence=[
                "run.googleapis.com/request_latencies p95 rose at 10:05 UTC",
                "5xx rate correlated with the same revision window",
            ],
            severity="high",
            recommended_actions=[
                "Compare dev-web-00099 vs previous revision metrics",
                "Check recent deploy changelog for connection pool changes",
            ],
            confidence="high",
            loop_count=1,
            token_cost=42,
            playbook_used=request.playbook.name,
        )


class DemoFollowupRuntime:
    async def run(self, request, tools, scanner):
        return FollowupOutput(
            answer=(
                "Follow-up: the latency spike aligns with revision dev-web-00099. "
                "Error logs show upstream timeout bursts in the same window."
            ),
            evidence=["logging: 12 timeout errors in 5m after rollout"],
        )


class RecordingSlackSender:
    def __init__(self):
        self.posts: list[dict[str, str]] = []

    def send(self, record):
        text = record.payload.get("hypothesis", record.payload.get("text", ""))
        self.posts.append({"kind": "primary", "text": str(text)[:200]})
        return FakeSlackRef(
            team=DEMO_TEAM,
            channel=DEMO_CHANNEL,
            thread=DEMO_THREAD,
            external_ref=f"{DEMO_CHANNEL}/{DEMO_THREAD}",
        )


class RecordingSlackGateway:
    def __init__(self):
        self.replies: list[dict[str, str]] = []

    def fetch_replies(self, *, channel, thread_ts):
        from app.external import ThreadMessage

        return [
            ThreadMessage(
                user_id=DEMO_USER,
                is_self_bot=False,
                text="<@UBOT9999> did the rollout cause this?",
                ts="1719999999.000200",
            ),
            ThreadMessage(
                user_id="UBOT9999",
                is_self_bot=True,
                text="Primary analysis: latency spike on dev-web.",
                ts="1719999999.000300",
            ),
        ]

    def post_reply(self, *, channel, thread_ts, text, client_msg_id):
        self.replies.append(
            {
                "channel": channel,
                "thread_ts": thread_ts,
                "text": text,
                "client_msg_id": client_msg_id,
            }
        )
        return "1720000001.000100"


class NoopGitHubSender:
    def send(self, record):
        if record.destination == "github_issue":
            return "https://github.com/acme/mogu/issues/999"
        return "https://github.com/acme/mogu/issues/999#issuecomment-demo"


class NoopObservation:
    def get_metrics(self, query, *, start, end):
        return {}

    def get_logs(self, query, *, start, end):
        return {}


def _demo_db_port() -> str:
    return os.environ.get("TEST_DB_PORT", DEFAULT_DB_PORT)


def _settings() -> Settings:
    # Direct Settings() construction bypasses HTTP auth (local demo only).
    return Settings(
        service_mode="worker",
        db_host=os.environ.get("TEST_DB_HOST", "127.0.0.1"),
        db_name=os.environ.get("TEST_DB_NAME", "mogu_test"),
        db_user=os.environ.get("TEST_DB_USER", "postgres"),
        db_password=os.environ.get("TEST_DB_PASSWORD", "postgres"),
        google_cloud_project=os.environ.get("GOOGLE_CLOUD_PROJECT", "mogu-demo"),
        allowed_resources=frozenset({"cloud_run/dev-web"}),
        allowed_alert_policies=frozenset({"dev-web-latency"}),
        pubsub_audience="",
        pubsub_push_sa_email="",
        ingest_skip_auth=True,
        max_embedding_budget=100,
        max_investigation_budget=50,
        l4_cosine_threshold=0.85,
        self_exclude_resource_prefixes=("incident-agent",),
        l3_storm_threshold=10,
        l3_storm_window_seconds=300,
        l2_grouping_window_seconds=900,
        absolute_deadline_seconds=540,
        lease_seconds=600,
        embedding_lease_seconds=60,
        slack_signing_secret="demo-secret",
        allowed_slack_team_ids=frozenset({DEMO_TEAM}),
        allowed_slack_channel_ids=frozenset({DEMO_CHANNEL}),
        allowed_slack_user_ids=frozenset({DEMO_USER}),
        slack_user_rate_limit_per_minute=10,
        slack_thread_rate_limit_per_hour=10,
        slack_lease_seconds=600,
        slack_channel_id=DEMO_CHANNEL,
        slack_team_id=DEMO_TEAM,
        github_repository="acme/mogu",
        embedding_backend="deterministic",
        session_backend="inmemory",
    )


def _demo_dsn(settings: Settings) -> str:
    return f"{settings.dsn} port={_demo_db_port()}"


def _pubsub_envelope(message_id: str, incident: dict[str, Any]) -> dict[str, Any]:
    data = base64.b64encode(json.dumps({"incident": incident}).encode()).decode()
    return {"message": {"messageId": message_id, "data": data}}


def _base_incident() -> dict[str, Any]:
    return {
        "policy_name": "dev-web-latency",
        "resource_name": "cloud_run/dev-web",
        "summary": "TEST INCIDENT: p99 latency spike on dev-web (synthetic demo)",
        "resource": {
            "type": "cloud_run_revision",
            "labels": {"project_id": "mogu", "service_name": "dev-web"},
        },
    }


def _log(title: str, detail: str = "") -> None:
    bar = "=" * 60
    print(f"\n{bar}\n{title}\n{bar}")
    if detail:
        print(detail)


def _wait_for_postgres(container: str) -> None:
    for _ in range(30):
        proc = subprocess.run(
            [
                "docker",
                "exec",
                container,
                "pg_isready",
                "-U",
                "postgres",
                "-d",
                "mogu_test",
            ],
            capture_output=True,
        )
        if proc.returncode == 0:
            return
        subprocess.run(["sleep", "1"], check=True)
    raise RuntimeError(f"Postgres in {container} did not become ready")


def _run_sql_in_container(container: str, sql: str) -> None:
    subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            container,
            "psql",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "postgres",
            "-d",
            "mogu_test",
        ],
        input=sql.encode(),
        check=True,
    )


def _run_sql_file_in_container(container: str, path: Path) -> None:
    print(f"Applying {path.name}")
    with path.open(encoding="utf-8") as handle:
        _run_sql_in_container(container, handle.read())


def _apply_migrations(container: str) -> None:
    db_root = Path(__file__).resolve().parents[1] / "db"
    _run_sql_file_in_container(container, db_root / "migrations" / "001_ops_schema.sql")
    _run_sql_file_in_container(container, db_root / "migrations" / "002_budget_primitives.sql")
    _run_sql_in_container(
        container,
        """
DO $$ BEGIN CREATE ROLE ops_ingest LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE ops_slack_ingress LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE ops_worker LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE ops_dispatcher LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE ops_operator LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE ops_reviewer LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
""",
    )
    for name in (
        "003_ops_roles.sql",
        "004_incident_review_gate.sql",
        "005_outbox_delivery_token.sql",
        "006_slack_retention_grants.sql",
    ):
        _run_sql_file_in_container(container, db_root / "migrations" / name)


def _bootstrap_db() -> None:
    port = _demo_db_port()
    subprocess.run(["docker", "rm", "-f", DEMO_CONTAINER], capture_output=True, check=False)
    subprocess.run(
        [
            "docker",
            "run",
            "-d",
            "--name",
            DEMO_CONTAINER,
            "-e",
            "POSTGRES_PASSWORD=postgres",
            "-e",
            "POSTGRES_DB=mogu_test",
            "-p",
            f"127.0.0.1:{port}:5432",
            "pgvector/pgvector:pg16",
        ],
        check=True,
    )
    _wait_for_postgres(DEMO_CONTAINER)
    _apply_migrations(DEMO_CONTAINER)


def _clear_ops(db: Database) -> None:
    with db.transaction() as conn:
        conn.execute(
            "TRUNCATE ops.slack_events, ops.outbox, ops.alert_deliveries, "
            "ops.incidents, ops.budget_usage CASCADE"
        )


def _ingest(db: Database, settings: Settings) -> InvestigationReady:
    ingest = IngestService(db, settings, DeterministicEmbeddingClient())
    message_id = f"demo-{uuid.uuid4()}"
    result = ingest.handle_pubsub(
        _pubsub_envelope(message_id, _base_incident()),
        RequestDeadline.create(),
    )
    if not isinstance(result, InvestigationReady):
        raise RuntimeError(f"ingest failed: {result}")
    return result


async def _investigate(db: Database, settings: Settings, ready: InvestigationReady) -> dict[str, Any]:
    service = InvestigationService(
        db,
        settings,
        runtime=DemoPrimaryRuntime(),
        observation_client=NoopObservation(),
    )
    return await service.investigate(ready, RequestDeadline.create())


def _deliver_outbox(db: Database, settings: Settings, incident_id: uuid.UUID) -> None:
    scanner = SecretScanner()
    slack = RecordingSlackSender()
    github = NoopGitHubSender()
    worker = OutboxWorker(db, slack=slack, github=github, scanner=scanner)
    with db.connection() as conn:
        rows = conn.execute(
            """
            SELECT id FROM ops.outbox
             WHERE incident_id = %s AND status = 'pending'
             ORDER BY created_at
            """,
            (incident_id,),
        ).fetchall()
    for row in rows:
        worker.handle(row["id"])


async def _followup(db: Database, settings: Settings, event_id: str) -> dict[str, Any]:
    gateway = RecordingSlackGateway()
    worker = SlackFollowupWorker(
        db,
        settings,
        gateway=gateway,
        runtime=DemoFollowupRuntime(),
        scanner=SecretScanner(),
        observation_client=NoopObservation(),
    )
    result = await worker.handle(event_id, task_name=f"slack-{event_id}")
    return {"result": result, "gateway": gateway}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--no-bootstrap",
        action="store_true",
        help="Skip Docker bootstrap; connect to TEST_DB_* / existing migrations.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    bootstrap = (
        not args.no_bootstrap
        and os.environ.get("TRIGGER_TEST_BOOTSTRAP_DB", "1") == "1"
    )
    if bootstrap:
        _bootstrap_db()

    settings = _settings()
    db = Database(_demo_dsn(settings))
    try:
        with db.connection() as conn:
            conn.execute("SELECT 1")
    except Exception as exc:
        print(f"Database not reachable: {exc}", file=sys.stderr)
        print(
            "Start Postgres, run with bootstrap (default), or set "
            "TEST_DB_HOST/TEST_DB_PORT/TEST_DB_NAME/TEST_DB_USER/TEST_DB_PASSWORD.",
            file=sys.stderr,
        )
        return 1

    _clear_ops(db)

    _log("1) アラート受信 (Pub/Sub → ingest)", _base_incident()["summary"])
    ready = _ingest(db, settings)
    print(f"incident_id={ready.incident_id}")

    _log("2) 一次調査 (LoopAgent デモ runtime)")
    primary = asyncio.run(_investigate(db, settings, ready))
    print(json.dumps(primary.body, ensure_ascii=False, indent=2))

    _log("3) outbox 配信 (Slack 一次通知 + GitHub Issue)")
    _deliver_outbox(db, settings, ready.incident_id)

    with db.connection() as conn:
        incident = conn.execute(
            """
            SELECT status, rca_hypothesis, github_issue, slack_team, slack_channel, slack_thread
              FROM ops.incidents WHERE id = %s
            """,
            (ready.incident_id,),
        ).fetchone()
    print(
        json.dumps(
            {
                "status": incident["status"],
                "github_issue": incident["github_issue"],
                "slack_thread": incident["slack_thread"],
                "rca_preview": (incident["rca_hypothesis"] or "")[:240],
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    event_id = "EvDEMO0001"
    _log("4) Slack app_mention 登録 (I6 ingress 相当)")
    outcome = register_slack_event(
        db,
        request=SlackEventRequest(
            event_id=event_id,
            task_name=f"slack-{event_id}",
            team_id=DEMO_TEAM,
            channel_id=DEMO_CHANNEL,
            thread_ts=DEMO_THREAD,
            user_id=DEMO_USER,
        ),
        rate_limit_per_minute=10,
    )
    print(f"register_slack_event → {outcome}")

    _log("5) 追調査 (I6 worker /tasks/slack 相当)")
    followup = asyncio.run(_followup(db, settings, event_id))
    print(json.dumps(followup["result"].body, ensure_ascii=False, indent=2))
    if followup["gateway"].replies:
        print("\n--- Slack thread reply (would post to Slack) ---")
        print(followup["gateway"].replies[0]["text"])

    with db.connection() as conn:
        comment = conn.execute(
            """
            SELECT payload FROM ops.outbox
             WHERE incident_id = %s AND destination = 'github_comment'
             ORDER BY created_at DESC LIMIT 1
            """,
            (ready.incident_id,),
        ).fetchone()
        event = conn.execute(
            "SELECT status FROM ops.slack_events WHERE event_id = %s",
            (event_id,),
        ).fetchone()
    if comment:
        print("\n--- GitHub issue comment (outbox payload) ---")
        print(comment["payload"].get("text", comment["payload"]))
    print(f"\nslack_event status: {event['status'] if event else 'missing'}")

    _log(
        "完了",
        "ローカルデモでは Slack/GitHub へ実送信しません。\n"
        "本番/dev では Monitoring → Pub/Sub → ingest → worker → 実 Slack スレッド、\n"
        "その後 @incident-agent で I6 追調査が動きます。\n"
        "手順: docs/incident-agent-dev-runbook.md",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
