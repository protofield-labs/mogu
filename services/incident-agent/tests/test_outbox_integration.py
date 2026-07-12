from __future__ import annotations

from uuid import uuid4

import pytest

from app.db import Database
from app.outbox import (
    claim_outbox,
    list_dispatchable_outbox,
    mark_outbox_sent,
    replay_failed_outbox,
    review_incident,
)
from app.owner import save_owner_analysis
from tests.conftest import requires_docker_pg
from tests.test_integration import _test_settings, skip_no_db


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
            "TRUNCATE ops.outbox, ops.alert_deliveries, ops.incidents CASCADE"
        )
    yield
    with db.transaction() as conn:
        conn.execute(
            "TRUNCATE ops.outbox, ops.alert_deliveries, ops.incidents CASCADE"
        )


def _incident(conn, *, status: str = "analyzed", kind: str = "normal", **values):
    incident_id = values.get("incident_id", uuid4())
    storm_key = f"storm-{incident_id}" if kind == "storm" else None
    return conn.execute(
        """
        INSERT INTO ops.incidents (
            id, incident_key, incident_kind, storm_key, alert_policy, resource,
            raw_alert, status, embedding, github_issue, merged_into
        )
        VALUES (
            %s, %s, %s, %s, 'policy', 'cloud_run/service', '{}'::jsonb,
            %s, %s::vector, %s, %s
        )
        RETURNING *
        """,
        (
            incident_id,
            f"key-{incident_id}",
            kind,
            storm_key,
            status,
            "[" + ",".join(["0"] * 768) + "]",
            values.get("github_issue"),
            values.get("merged_into"),
        ),
    ).fetchone()


@requires_docker_pg
@skip_no_db
def test_dependency_wait_and_atomic_reference_commit(
    db_available: bool, clean_ops
) -> None:
    if not db_available:
        pytest.skip("test database unavailable")
    db = Database(_test_settings().dsn)
    with db.transaction() as conn:
        incident = _incident(conn)
        issue = conn.execute(
            """
            INSERT INTO ops.outbox (
                incident_id, destination, idempotency_key, payload
            ) VALUES (%s, 'github_issue', 'issue-1', '{}'::jsonb)
            RETURNING id
            """,
            (incident["id"],),
        ).fetchone()
        comment = conn.execute(
            """
            INSERT INTO ops.outbox (
                incident_id, destination, idempotency_key, payload, depends_on
            ) VALUES (%s, 'github_comment', 'comment-1', '{}'::jsonb, %s)
            RETURNING id
            """,
            (incident["id"], issue["id"]),
        ).fetchone()

    assert list_dispatchable_outbox(db) == [(issue["id"], 0)]
    issue_claim = claim_outbox(db, outbox_id=issue["id"], lease_seconds=300)
    assert issue_claim.state == "claimed"
    duplicate_claim = claim_outbox(db, outbox_id=issue["id"], lease_seconds=300)
    assert duplicate_claim.state == "busy"
    assert mark_outbox_sent(
        db,
        record=issue_claim.record,
        external_ref="https://github.com/acme/repo/issues/7",
    )
    assert claim_outbox(db, outbox_id=issue["id"], lease_seconds=300).state == "sent"
    assert list_dispatchable_outbox(db) == [(comment["id"], 0)]
    comment_claim = claim_outbox(db, outbox_id=comment["id"], lease_seconds=300)
    assert comment_claim.record.github_issue.endswith("/issues/7")
    assert comment_claim.record.dependency_external_ref.endswith("/issues/7")


@requires_docker_pg
@skip_no_db
def test_replay_changes_only_delivery_state_and_generation(
    db_available: bool, clean_ops
) -> None:
    if not db_available:
        pytest.skip("test database unavailable")
    db = Database(_test_settings().dsn)
    dependency = uuid4()
    with db.transaction() as conn:
        incident = _incident(conn)
        conn.execute(
            """
            INSERT INTO ops.outbox (
                id, incident_id, destination, idempotency_key, payload,
                depends_on, status, attempt_count
            ) VALUES (%s, %s, 'slack', 'immutable-key',
                      '{"text":"immutable"}'::jsonb, NULL, 'failed', 10)
            """,
            (dependency, incident["id"]),
        )
        before = conn.execute(
            """
            SELECT destination, idempotency_key, payload, depends_on,
                   dispatch_generation
              FROM ops.outbox WHERE id = %s
            """,
            (dependency,),
        ).fetchone()

    assert replay_failed_outbox(db, dependency)
    with db.connection() as conn:
        after = conn.execute(
            """
            SELECT destination, idempotency_key, payload, depends_on,
                   dispatch_generation, status, attempt_count
              FROM ops.outbox WHERE id = %s
            """,
            (dependency,),
        ).fetchone()
    assert after["destination"] == before["destination"]
    assert after["idempotency_key"] == before["idempotency_key"]
    assert after["payload"] == before["payload"]
    assert after["depends_on"] == before["depends_on"]
    assert after["dispatch_generation"] == before["dispatch_generation"] + 1
    assert after["status"] == "pending"
    assert after["attempt_count"] == 0
    assert not replay_failed_outbox(db, dependency)


@requires_docker_pg
@skip_no_db
def test_expired_sending_row_is_redispatched_with_recovery_generation(
    db_available: bool, clean_ops
) -> None:
    if not db_available:
        pytest.skip("test database unavailable")
    db = Database(_test_settings().dsn)
    with db.transaction() as conn:
        incident = _incident(conn)
        outbox = conn.execute(
            """
            INSERT INTO ops.outbox (
                incident_id, destination, idempotency_key, payload
            ) VALUES (%s, 'github_issue', 'crash-recovery', '{}'::jsonb)
            RETURNING id
            """,
            (incident["id"],),
        ).fetchone()
    first = claim_outbox(db, outbox_id=outbox["id"], lease_seconds=300)
    with db.transaction() as conn:
        conn.execute(
            """
            UPDATE ops.outbox
               SET lease_expires_at = now() - interval '1 second'
             WHERE id = %s
            """,
            (outbox["id"],),
        )

    assert list_dispatchable_outbox(db) == [(outbox["id"], 1)]
    recovery = claim_outbox(db, outbox_id=outbox["id"], lease_seconds=300)
    assert recovery.state == "claimed"
    assert recovery.record.attempt_count == 2
    assert not mark_outbox_sent(
        db,
        record=first.record,
        external_ref="https://github.com/acme/repo/issues/7",
    )
    assert mark_outbox_sent(
        db,
        record=recovery.record,
        external_ref="https://github.com/acme/repo/issues/7",
    )


@requires_docker_pg
@skip_no_db
def test_review_incident_atomically_promotes_human_rca(
    db_available: bool, clean_ops
) -> None:
    if not db_available:
        pytest.skip("test database unavailable")
    db = Database(_test_settings().dsn)
    with db.transaction() as conn:
        incident = _incident(conn)

    assert review_incident(
        db,
        incident_id=incident["id"],
        rca_summary="Connection pool exhausted after deployment.",
        reviewer_id="oncall@example.com",
    )
    with db.connection() as conn:
        reviewed = conn.execute(
            "SELECT * FROM ops.incidents WHERE id = %s", (incident["id"],)
        ).fetchone()
    assert reviewed["status"] == "resolved"
    assert reviewed["resolved_at"] is not None
    assert reviewed["rca_reviewed"] is True
    assert reviewed["reviewed_at"] is not None
    assert reviewed["reviewed_by"] == "oncall@example.com"
    assert reviewed["rca_hypothesis"].startswith("Connection pool")
    assert not review_incident(
        db,
        incident_id=incident["id"],
        rca_summary="second review",
        reviewer_id="other",
    )


@requires_docker_pg
@skip_no_db
def test_storm_analysis_creates_issue_comment_close_dependency_chain(
    db_available: bool, clean_ops
) -> None:
    if not db_available:
        pytest.skip("test database unavailable")
    db = Database(_test_settings().dsn)
    token = uuid4()
    with db.transaction() as conn:
        storm = _incident(conn, status="investigating", kind="storm")
        normal = _incident(
            conn,
            status="merged",
            github_issue="https://github.com/acme/repo/issues/4",
            merged_into=storm["id"],
        )
        conn.execute(
            """
            UPDATE ops.incidents
               SET investigation_token = %s
             WHERE id = %s
            """,
            (token, storm["id"]),
        )
        conn.execute(
            """
            INSERT INTO ops.alert_deliveries (
                message_id, resource, alert_policy, incident_key,
                sanitized_alert, incident_id, is_owner, status, work_token
            ) VALUES (
                'storm-owner', 'cloud_run/service', 'policy', 'delivery-key',
                '{}'::jsonb, %s, true, 'processing', %s
            )
            """,
            (storm["id"], token),
        )

    saved = save_owner_analysis(
        db,
        incident_id=storm["id"],
        delivery_message_id="storm-owner",
        investigation_token=token,
        work_token=token,
        analysis={"severity": "high", "rca_hypothesis": "storm"},
        outbox_entries=[
            {
                "destination": "github_issue",
                "idempotency_key": f"primary-github-issue:{storm['id']}",
                "payload": {"text": "storm"},
            }
        ],
    )
    assert saved.success
    with db.connection() as conn:
        rows = conn.execute(
            """
            SELECT destination, incident_id, depends_on, id
              FROM ops.outbox ORDER BY created_at, destination
            """
        ).fetchall()
    by_destination = {row["destination"]: row for row in rows}
    assert by_destination["github_issue"]["incident_id"] == storm["id"]
    assert by_destination["github_comment"]["incident_id"] == normal["id"]
    assert (
        by_destination["github_comment"]["depends_on"]
        == by_destination["github_issue"]["id"]
    )
    assert (
        by_destination["github_close"]["depends_on"]
        == by_destination["github_comment"]["id"]
    )
