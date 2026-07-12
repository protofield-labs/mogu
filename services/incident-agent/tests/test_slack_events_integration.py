from __future__ import annotations

from uuid import uuid4

import pytest

from app.db import Database
from app.slack_events import (
    SlackEventRequest,
    claim_slack_event,
    complete_slack_event,
    count_thread_events_last_hour,
    delete_expired_slack_events,
    list_session_cleanup_incidents,
    load_slack_event,
    lookup_incident_for_thread,
    register_slack_event,
    release_slack_event,
    reserve_followup_budget,
    save_followup_comment_and_complete,
)
from tests.conftest import requires_docker_pg
from tests.test_integration import _test_settings, skip_no_db

ZERO_VECTOR = "[" + ",".join(["0"] * 768) + "]"


@pytest.fixture
def db_available() -> bool:
    try:
        with Database(_test_settings().dsn).connection() as conn:
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
    with db.transaction() as conn:
        conn.execute(
            "TRUNCATE ops.slack_events, ops.outbox, ops.alert_deliveries, "
            "ops.incidents, ops.budget_usage CASCADE"
        )
    yield
    with db.transaction() as conn:
        conn.execute(
            "TRUNCATE ops.slack_events, ops.outbox, ops.alert_deliveries, "
            "ops.incidents, ops.budget_usage CASCADE"
        )


def _request(event_id: str, *, user_id: str = "U0123456") -> SlackEventRequest:
    return SlackEventRequest(
        event_id=event_id,
        task_name=f"slack-{event_id}",
        team_id="T0123456",
        channel_id="C0123456",
        thread_ts="1719999999.000100",
        user_id=user_id,
    )


def _insert_incident(conn, **values):
    incident_id = values.get("incident_id", uuid4())
    return conn.execute(
        """
        INSERT INTO ops.incidents (
            id, incident_key, alert_policy, resource, raw_alert, status,
            embedding, github_issue, slack_team, slack_channel, slack_thread,
            resolved_at, rca_hypothesis
        ) VALUES (
            %s, %s, 'dev-web-latency', 'cloud_run/dev-web', '{}'::jsonb, %s,
            %s::vector, %s, %s, %s, %s, %s, %s
        )
        RETURNING id
        """,
        (
            incident_id,
            f"key-{incident_id}",
            values.get("status", "analyzed"),
            ZERO_VECTOR,
            values.get("github_issue", "https://github.com/acme/repo/issues/7"),
            values.get("slack_team", "T0123456"),
            values.get("slack_channel", "C0123456"),
            values.get("slack_thread", "1719999999.000100"),
            values.get("resolved_at"),
            values.get("rca_hypothesis", "仮説: cause"),
        ),
    ).fetchone()["id"]


@requires_docker_pg
@skip_no_db
class TestSlackEventRegistration:
    def test_idempotent_registration_and_rate_limit(self, db_available, clean_ops):
        if not db_available:
            pytest.skip("test database not reachable")
        db = Database(_test_settings().dsn)

        assert (
            register_slack_event(
                db, request=_request("EvAAAA1111"), rate_limit_per_minute=2
            )
            == "registered"
        )
        # Same event again: pending → retry_enqueue, never a second row.
        assert (
            register_slack_event(
                db, request=_request("EvAAAA1111"), rate_limit_per_minute=2
            )
            == "retry_enqueue"
        )
        # Second distinct event within the window is allowed (limit 2).
        assert (
            register_slack_event(
                db, request=_request("EvAAAA2222"), rate_limit_per_minute=2
            )
            == "registered"
        )
        # Third hits the per-user 1-minute cap: no row is created.
        assert (
            register_slack_event(
                db, request=_request("EvAAAA3333"), rate_limit_per_minute=2
            )
            == "rate_limited"
        )
        assert load_slack_event(db, "EvAAAA3333") is None
        # Zero/unset limit is default-deny (§7-8).
        assert (
            register_slack_event(
                db,
                request=_request("EvAAAA4444", user_id="U7777777"),
                rate_limit_per_minute=0,
            )
            == "rate_limited"
        )

    def test_thread_rate_counter(self, db_available, clean_ops):
        if not db_available:
            pytest.skip("test database not reachable")
        db = Database(_test_settings().dsn)
        register_slack_event(
            db, request=_request("EvBBBB1111"), rate_limit_per_minute=10
        )
        register_slack_event(
            db, request=_request("EvBBBB2222"), rate_limit_per_minute=10
        )

        assert (
            count_thread_events_last_hour(
                db,
                team_id="T0123456",
                channel_id="C0123456",
                thread_ts="1719999999.000100",
                user_id="U0123456",
            )
            == 2
        )


@requires_docker_pg
@skip_no_db
class TestSlackEventLifecycle:
    def test_claim_lease_and_three_attempt_cap(self, db_available, clean_ops):
        if not db_available:
            pytest.skip("test database not reachable")
        db = Database(_test_settings().dsn)
        register_slack_event(
            db, request=_request("EvCCCC1111"), rate_limit_per_minute=10
        )

        outcome, claimed = claim_slack_event(
            db, event_id="EvCCCC1111", lease_seconds=600, incident_id=None
        )
        assert outcome == "claimed"
        assert claimed is not None and claimed.attempt_count == 1

        # Active lease blocks a second claim.
        outcome, _ = claim_slack_event(
            db, event_id="EvCCCC1111", lease_seconds=600, incident_id=None
        )
        assert outcome == "busy"

        # Release → pending; two more attempts reach the cap.
        assert release_slack_event(db, event_id="EvCCCC1111") == "pending"
        for expected_attempt in (2, 3):
            outcome, claimed = claim_slack_event(
                db, event_id="EvCCCC1111", lease_seconds=600, incident_id=None
            )
            assert outcome == "claimed"
            assert claimed is not None
            assert claimed.attempt_count == expected_attempt
            release_slack_event(db, event_id="EvCCCC1111")
        outcome, _ = claim_slack_event(
            db, event_id="EvCCCC1111", lease_seconds=600, incident_id=None
        )
        assert outcome == "failed"

    def test_incident_exclusive_execution(self, db_available, clean_ops):
        if not db_available:
            pytest.skip("test database not reachable")
        db = Database(_test_settings().dsn)
        with db.transaction() as conn:
            incident_id = _insert_incident(conn)
        register_slack_event(
            db, request=_request("EvDDDD1111"), rate_limit_per_minute=10
        )
        register_slack_event(
            db, request=_request("EvDDDD2222"), rate_limit_per_minute=10
        )

        outcome, _ = claim_slack_event(
            db, event_id="EvDDDD1111", lease_seconds=600, incident_id=incident_id
        )
        assert outcome == "claimed"
        # §11: only one follow-up per incident may run at a time.
        outcome, _ = claim_slack_event(
            db, event_id="EvDDDD2222", lease_seconds=600, incident_id=incident_id
        )
        assert outcome == "incident_busy"

    def test_concurrent_claims_for_same_incident_are_serialized(
        self, db_available, clean_ops
    ):
        """Two tasks claiming different events on one incident: exactly one wins."""
        if not db_available:
            pytest.skip("test database not reachable")
        import threading

        db = Database(_test_settings().dsn)
        with db.transaction() as conn:
            incident_id = _insert_incident(conn)
        register_slack_event(
            db, request=_request("EvEEEE1111"), rate_limit_per_minute=10
        )
        register_slack_event(
            db, request=_request("EvEEEE2222"), rate_limit_per_minute=10
        )

        barrier = threading.Barrier(2)
        outcomes: dict[str, str] = {}

        def claim(event_id: str) -> None:
            local_db = Database(_test_settings().dsn)
            barrier.wait()
            outcome, _ = claim_slack_event(
                local_db,
                event_id=event_id,
                lease_seconds=600,
                incident_id=incident_id,
            )
            outcomes[event_id] = outcome

        threads = [
            threading.Thread(target=claim, args=(event_id,))
            for event_id in ("EvEEEE1111", "EvEEEE2222")
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        assert sorted(outcomes.values()) == ["claimed", "incident_busy"]

    def test_budget_charged_at_most_once_per_event(self, db_available, clean_ops):
        """Retries of the same event must not drain the shared daily budget."""
        if not db_available:
            pytest.skip("test database not reachable")
        db = Database(_test_settings().dsn)
        register_slack_event(
            db, request=_request("EvGGGG1111"), rate_limit_per_minute=10
        )

        assert reserve_followup_budget(db, event_id="EvGGGG1111", max_budget=10)
        # Second reservation (Cloud Tasks retry) reuses the first charge.
        assert reserve_followup_budget(db, event_id="EvGGGG1111", max_budget=10)
        with db.connection() as conn:
            usage = conn.execute(
                "SELECT investigation_count FROM ops.budget_usage"
            ).fetchone()
        assert usage is not None and usage["investigation_count"] == 1

        # Unregistered events never charge budget.
        assert not reserve_followup_budget(db, event_id="EvNOPE9999", max_budget=10)

    def test_comment_outbox_and_completion_are_atomic(self, db_available, clean_ops):
        if not db_available:
            pytest.skip("test database not reachable")
        db = Database(_test_settings().dsn)
        with db.transaction() as conn:
            incident_id = _insert_incident(conn)
            issue_outbox_id = conn.execute(
                """
                INSERT INTO ops.outbox (
                    incident_id, destination, idempotency_key, payload, status
                ) VALUES (%s, 'github_issue', %s, '{}'::jsonb, 'sent')
                RETURNING id
                """,
                (incident_id, f"issue-{incident_id}"),
            ).fetchone()["id"]
        register_slack_event(
            db, request=_request("EvEEEE1111"), rate_limit_per_minute=10
        )
        claim_slack_event(
            db, event_id="EvEEEE1111", lease_seconds=600, incident_id=incident_id
        )

        saved = save_followup_comment_and_complete(
            db,
            event_id="EvEEEE1111",
            incident_id=incident_id,
            issue_outbox_id=issue_outbox_id,
            payload={"kind": "slack_followup", "text": "finding"},
        )

        assert saved is True
        with db.connection() as conn:
            outbox = conn.execute(
                """
                SELECT destination, depends_on, status FROM ops.outbox
                 WHERE idempotency_key = 'slack-followup:EvEEEE1111'
                """
            ).fetchone()
            event = conn.execute(
                "SELECT status FROM ops.slack_events WHERE event_id = 'EvEEEE1111'"
            ).fetchone()
        assert outbox["destination"] == "github_comment"
        assert outbox["depends_on"] == issue_outbox_id
        assert outbox["status"] == "pending"
        assert event["status"] == "completed"

        # A stale second completion neither duplicates the comment nor errors.
        assert (
            save_followup_comment_and_complete(
                db,
                event_id="EvEEEE1111",
                incident_id=incident_id,
                issue_outbox_id=issue_outbox_id,
                payload={"kind": "slack_followup", "text": "finding"},
            )
            is False
        )


@requires_docker_pg
@skip_no_db
class TestThreadLookupAndRetention:
    def test_lookup_requires_unresolved_incident_with_issue_refs(
        self, db_available, clean_ops
    ):
        if not db_available:
            pytest.skip("test database not reachable")
        db = Database(_test_settings().dsn)
        with db.transaction() as conn:
            incident_id = _insert_incident(conn)
            issue_outbox_id = conn.execute(
                """
                INSERT INTO ops.outbox (
                    incident_id, destination, idempotency_key, payload, status
                ) VALUES (%s, 'github_issue', %s, '{}'::jsonb, 'sent')
                RETURNING id
                """,
                (incident_id, f"issue-{incident_id}"),
            ).fetchone()["id"]
            # Resolved incident on a different thread must never match.
            _insert_incident(
                conn,
                status="resolved",
                resolved_at="2024-01-01T00:00:00+00:00",
                slack_thread="1719990000.000100",
            )

        found = lookup_incident_for_thread(
            db,
            team_id="T0123456",
            channel_id="C0123456",
            thread_ts="1719999999.000100",
        )
        assert found is not None
        assert found.id == incident_id
        assert found.issue_outbox_id == issue_outbox_id

        missing = lookup_incident_for_thread(
            db,
            team_id="T0123456",
            channel_id="C0123456",
            thread_ts="1719990000.000100",
        )
        assert missing is None

    def test_retention_deletes_only_old_finished_events(
        self, db_available, clean_ops
    ):
        if not db_available:
            pytest.skip("test database not reachable")
        db = Database(_test_settings().dsn)
        register_slack_event(
            db, request=_request("EvFFFF1111"), rate_limit_per_minute=10
        )
        claim_slack_event(
            db, event_id="EvFFFF1111", lease_seconds=600, incident_id=None
        )
        complete_slack_event(db, event_id="EvFFFF1111")
        register_slack_event(
            db, request=_request("EvFFFF2222"), rate_limit_per_minute=10
        )
        with db.transaction() as conn:
            conn.execute(
                """
                UPDATE ops.slack_events
                   SET completed_at = now() - interval '8 days',
                       received_at = now() - interval '8 days'
                 WHERE event_id = 'EvFFFF1111'
                """
            )

        deleted = delete_expired_slack_events(db, retention_days=7)

        assert deleted == 1
        assert load_slack_event(db, "EvFFFF1111") is None
        # Pending rows are never purged regardless of age.
        assert load_slack_event(db, "EvFFFF2222") is not None

    def test_session_cleanup_includes_very_old_incidents(
        self, db_available, clean_ops
    ):
        """No upper bound: incidents resolved long ago must still be listed."""
        if not db_available:
            pytest.skip("test database not reachable")
        db = Database(_test_settings().dsn)
        with db.transaction() as conn:
            old_id = _insert_incident(
                conn,
                status="resolved",
                resolved_at="2020-01-01T00:00:00+00:00",
                slack_thread="1719990001.000100",
            )
            recent_id = _insert_incident(
                conn,
                status="resolved",
                resolved_at="2024-06-01T00:00:00+00:00",
                slack_thread="1719990002.000100",
            )
            # Unresolved incidents are never listed.
            _insert_incident(
                conn,
                status="analyzed",
                resolved_at=None,
                slack_thread="1719990003.000100",
            )

        listed = list_session_cleanup_incidents(db, retention_days=30)

        assert old_id in listed
        assert recent_id in listed
        assert len(listed) == 2

        with pytest.raises(ValueError):
            list_session_cleanup_incidents(db, retention_days=0)
