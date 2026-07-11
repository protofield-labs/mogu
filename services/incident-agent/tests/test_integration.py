from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.config import Settings
from app.db import Database
from app.deadline import RequestDeadline
from app.embedding import DeterministicEmbeddingClient
from app.ingest import IngestService
from app.keys import compute_incident_key
from app.masking import mask_alert
from app.noise import InvestigationReady
from app.owner import renew_owner_lease, save_owner_analysis
from tests.conftest import requires_docker_pg

ZERO_VECTOR = "[" + ",".join(["0"] * 768) + "]"


def _test_settings(**overrides) -> Settings:
    defaults = dict(
        service_mode="ingest",
        db_host=os.environ.get("TEST_DB_HOST", "localhost"),
        db_name=os.environ.get("TEST_DB_NAME", "mogu_test"),
        db_user=os.environ.get("TEST_DB_USER", "postgres"),
        db_password=os.environ.get("TEST_DB_PASSWORD", "postgres"),
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
    )
    defaults.update(overrides)
    return Settings(**defaults)


def _pubsub_envelope(message_id: str, incident: dict) -> dict:
    import base64

    data = base64.b64encode(json.dumps({"incident": incident}).encode()).decode()
    return {"message": {"messageId": message_id, "data": data}}


def _base_incident(**overrides) -> dict:
    base = {
        "policy_name": "dev-web-latency",
        "resource_name": "cloud_run/dev-web",
        "summary": "latency spike detected",
        "resource": {
            "type": "cloud_run_revision",
            "labels": {"project_id": "mogu", "service_name": "dev-web"},
        },
    }
    base.update(overrides)
    return base


@pytest.fixture
def db_available() -> bool:
    settings = _test_settings()
    try:
        with Database(settings.dsn).connection() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


skip_no_db = pytest.mark.skipif(
    os.environ.get("INCIDENT_AGENT_INTEGRATION") != "1",
    reason="Set INCIDENT_AGENT_INTEGRATION=1 with migrated test DB",
)


@requires_docker_pg
@skip_no_db
class TestNoiseControlIntegration:
    def test_message_id_idempotency_checkpoint(self, db_available: bool) -> None:
        if not db_available:
            pytest.skip("test database not reachable")

        settings = _test_settings()
        db = Database(settings.dsn)
        service = IngestService(db, settings, DeterministicEmbeddingClient())
        deadline = RequestDeadline.create()

        msg_id = f"test-{uuid.uuid4()}"
        body = _pubsub_envelope(msg_id, _base_incident())

        result1 = service.handle_pubsub(body, deadline)
        result2 = service.handle_pubsub(body, deadline)

        assert isinstance(result1, InvestigationReady)
        assert result2.status_code == 503
        assert result2.body == {"error": "owner lease active"}
        with db.connection() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS cnt FROM ops.alert_deliveries WHERE message_id = %s",
                (msg_id,),
            ).fetchone()
        assert row["cnt"] == 1

    def test_active_masking_checkpoint_returns_retry(
        self, db_available: bool
    ) -> None:
        if not db_available:
            pytest.skip("test database not reachable")

        settings = _test_settings()
        db = Database(settings.dsn)
        service = IngestService(db, settings, DeterministicEmbeddingClient())
        msg_id = f"masking-{uuid.uuid4()}"
        body = _pubsub_envelope(msg_id, _base_incident())
        raw_payload = {"incident": _base_incident()}

        checkpoint = service._checkpoint(msg_id, raw_payload)
        assert isinstance(checkpoint, tuple)
        _, is_new = checkpoint
        assert is_new

        concurrent = service.handle_pubsub(body, RequestDeadline.create())

        assert concurrent.status_code == 503
        assert concurrent.body == {"error": "masking in progress"}

    def test_l3_embedding_budget_failure_creates_storm(
        self, db_available: bool
    ) -> None:
        if not db_available:
            pytest.skip("test database not reachable")

        suffix = uuid.uuid4().hex
        resource = f"cloud_run/{suffix}"
        policy = f"policy-{suffix}"
        settings = _test_settings(
            allowed_resources=frozenset({resource}),
            allowed_alert_policies=frozenset({policy}),
            l3_storm_threshold=0,
            max_embedding_budget=0,
        )
        db = Database(settings.dsn)
        service = IngestService(db, settings, DeterministicEmbeddingClient())
        msg_id = f"storm-budget-{suffix}"
        body = _pubsub_envelope(
            msg_id,
            _base_incident(
                policy_name=policy,
                resource_name=resource,
                resource={
                    "type": "cloud_run_revision",
                    "labels": {"service_name": suffix},
                },
            ),
        )

        result = service.handle_pubsub(body, RequestDeadline.create())

        assert result.status_code == 200
        assert result.body["action"] == "escalated"
        with db.connection() as conn:
            incident = conn.execute(
                """
                SELECT i.incident_kind, i.status, i.storm_key, d.status AS delivery_status
                  FROM ops.alert_deliveries d
                  JOIN ops.incidents i ON i.id = d.incident_id
                 WHERE d.message_id = %s
                """,
                (msg_id,),
            ).fetchone()
        assert incident["incident_kind"] == "storm"
        assert incident["status"] == "escalated"
        assert incident["storm_key"] is not None
        assert incident["delivery_status"] == "completed"

    def test_completed_delivery_cannot_be_reclaimed_as_owner(
        self, db_available: bool
    ) -> None:
        if not db_available:
            pytest.skip("test database not reachable")

        suffix = uuid.uuid4().hex
        resource = f"cloud_run/{suffix}"
        policy = f"policy-{suffix}"
        settings = _test_settings(
            allowed_resources=frozenset({resource}),
            allowed_alert_policies=frozenset({policy}),
        )
        db = Database(settings.dsn)
        service = IngestService(db, settings, DeterministicEmbeddingClient())
        msg_id = f"completed-{suffix}"
        embedding = [0.0] * 768
        alert = {
            "v": 1,
            "alert_policy": policy,
            "resource": resource,
            "service": suffix,
            "host": None,
            "message": "completed delivery",
        }

        with db.transaction() as conn:
            row = conn.execute(
                """
                INSERT INTO ops.alert_deliveries (
                    message_id, resource, alert_policy, incident_key, sanitized_alert,
                    status, completed_at, embedding
                ) VALUES (%s, %s, %s, %s, %s::jsonb, 'completed', now(), %s::vector)
                RETURNING *
                """,
                (
                    msg_id,
                    resource,
                    policy,
                    compute_incident_key(alert),
                    json.dumps(alert),
                    "[" + ",".join(["0"] * 768) + "]",
                ),
            ).fetchone()
        from app.noise import _row_to_delivery

        result = service._orchestrator._post_embedding_phase(
            _row_to_delivery(row),
            alert,
            embedding,
            RequestDeadline.create(),
        )

        assert result.status_code == 200
        assert result.body == {"action": "already_completed"}
        with db.connection() as conn:
            count = conn.execute(
                "SELECT COUNT(*) AS cnt FROM ops.incidents WHERE resource = %s",
                (resource,),
            ).fetchone()
        assert count["cnt"] == 0


@requires_docker_pg
@skip_no_db
class TestStormMerge:
    def test_merge_normals_into_storm(self, db_available: bool) -> None:
        if not db_available:
            pytest.skip("test database not reachable")

        from app.noise import merge_normals_into_storm

        settings = _test_settings()
        db = Database(settings.dsn)
        storm_id = uuid.uuid4()
        normal_id = uuid.uuid4()
        token = uuid.uuid4()

        with db.transaction() as conn:
            conn.execute(
                """
                INSERT INTO ops.incidents (id, incident_key, alert_policy, resource, raw_alert, status,
                    incident_kind, storm_key, investigation_token, lease_expires_at, embedding)
                VALUES (%s, 'storm-key', 'dev-web-latency', 'cloud_run/dev-web', '{}', 'investigating',
                    'storm', 'storm-key', %s, now() + interval '600 seconds', %s::vector)
                """,
                (storm_id, token, ZERO_VECTOR),
            )
            conn.execute(
                """
                INSERT INTO ops.incidents (id, incident_key, alert_policy, resource, raw_alert, status,
                    investigation_token, lease_expires_at, embedding)
                VALUES (%s, 'normal-key', 'dev-web-latency', 'cloud_run/dev-web', '{}', 'investigating',
                    %s, now() + interval '600 seconds', %s::vector)
                """,
                (normal_id, uuid.uuid4(), ZERO_VECTOR),
            )
            conn.execute(
                """
                INSERT INTO ops.alert_deliveries (
                    message_id, resource, alert_policy, incident_key, sanitized_alert,
                    incident_id, is_owner, status, work_token
                ) VALUES ('owner-msg', 'cloud_run/dev-web', 'dev-web-latency', 'normal-key', '{}',
                    %s, true, 'processing', %s)
                """,
                (normal_id, uuid.uuid4()),
            )

            new_token = uuid.uuid4()
            merge_normals_into_storm(
                conn,
                storm_id=storm_id,
                resource="cloud_run/dev-web",
                alert_policy="dev-web-latency",
                new_token=new_token,
            )

            normal = conn.execute(
                "SELECT status, merged_into FROM ops.incidents WHERE id = %s", (normal_id,)
            ).fetchone()
            delivery = conn.execute(
                "SELECT status, is_owner, work_token FROM ops.alert_deliveries WHERE message_id = 'owner-msg'"
            ).fetchone()

        assert normal["status"] == "merged"
        assert normal["merged_into"] == storm_id
        assert delivery["status"] == "completed"
        assert delivery["is_owner"] is False
        assert delivery["work_token"] == new_token


@requires_docker_pg
@skip_no_db
class TestOwnerCAS:
    def test_save_owner_analysis_cas_race(self, db_available: bool) -> None:
        if not db_available:
            pytest.skip("test database not reachable")

        settings = _test_settings()
        db = Database(settings.dsn)
        incident_id = uuid.uuid4()
        token = uuid.uuid4()
        msg_id = f"owner-{uuid.uuid4()}"

        with db.transaction() as conn:
            conn.execute(
                """
                INSERT INTO ops.incidents (id, incident_key, alert_policy, resource, raw_alert, status,
                    investigation_token, lease_expires_at, embedding)
                VALUES (%s, 'key-1', 'dev-web-latency', 'cloud_run/dev-web', '{}', 'investigating',
                    %s, now() + interval '600 seconds', %s::vector)
                """,
                (incident_id, token, ZERO_VECTOR),
            )
            conn.execute(
                """
                INSERT INTO ops.alert_deliveries (
                    message_id, resource, alert_policy, incident_key, sanitized_alert,
                    incident_id, is_owner, status, work_token
                ) VALUES (%s, 'cloud_run/dev-web', 'dev-web-latency', 'key-1', '{}',
                    %s, true, 'processing', %s)
                """,
                (msg_id, incident_id, token),
            )

        ok = save_owner_analysis(
            db,
            incident_id=incident_id,
            delivery_message_id=msg_id,
            investigation_token=token,
            work_token=token,
            analysis={"severity": "high", "rca_hypothesis": "DB connection pool exhausted"},
        )
        assert ok.success

        stale = save_owner_analysis(
            db,
            incident_id=incident_id,
            delivery_message_id=msg_id,
            investigation_token=token,
            work_token=token,
            analysis={"severity": "low", "rca_hypothesis": "stale write"},
        )
        assert not stale.success

    def test_renew_lease_cas(self, db_available: bool) -> None:
        if not db_available:
            pytest.skip("test database not reachable")

        settings = _test_settings()
        db = Database(settings.dsn)
        incident_id = uuid.uuid4()
        token = uuid.uuid4()
        msg_id = f"lease-{uuid.uuid4()}"
        expired = datetime.now(timezone.utc) - timedelta(seconds=10)

        with db.transaction() as conn:
            conn.execute(
                """
                INSERT INTO ops.incidents (id, incident_key, alert_policy, resource, raw_alert, status,
                    investigation_token, lease_expires_at, attempt_count, embedding)
                VALUES (%s, 'key-2', 'dev-web-latency', 'cloud_run/dev-web', '{}', 'investigating',
                    %s, %s, 1, %s::vector)
                """,
                (incident_id, token, expired, ZERO_VECTOR),
            )
            conn.execute(
                """
                INSERT INTO ops.alert_deliveries (
                    message_id, resource, alert_policy, incident_key, sanitized_alert,
                    incident_id, is_owner, status, work_token, work_lease_expires_at
                ) VALUES (%s, 'cloud_run/dev-web', 'dev-web-latency', 'key-2', '{}',
                    %s, true, 'processing', %s, %s)
                """,
                (msg_id, incident_id, token, expired),
            )

        renewed = renew_owner_lease(
            db,
            incident_id=incident_id,
            delivery_message_id=msg_id,
            investigation_token=token,
            work_token=token,
        )
        assert renewed.success
        assert renewed.new_token is not None
        assert renewed.attempt_count == 2

        stale_renew = renew_owner_lease(
            db,
            incident_id=incident_id,
            delivery_message_id=msg_id,
            investigation_token=token,
            work_token=token,
        )
        assert not stale_renew.success

    def test_save_owner_analysis_rejects_cross_incident_delivery(
        self, db_available: bool
    ) -> None:
        if not db_available:
            pytest.skip("test database not reachable")

        settings = _test_settings()
        db = Database(settings.dsn)
        incident_a = uuid.uuid4()
        incident_b = uuid.uuid4()
        token_a = uuid.uuid4()
        token_b = uuid.uuid4()
        message_b = f"owner-cross-{uuid.uuid4()}"

        with db.transaction() as conn:
            for incident_id, key, token in (
                (incident_a, f"key-{incident_a}", token_a),
                (incident_b, f"key-{incident_b}", token_b),
            ):
                conn.execute(
                    """
                    INSERT INTO ops.incidents (
                        id, incident_key, alert_policy, resource, raw_alert, status,
                        embedding, investigation_token, lease_expires_at
                    ) VALUES (
                        %s, %s, 'dev-web-latency', 'cloud_run/dev-web', '{}',
                        'investigating', %s::vector, %s, now() + interval '600 seconds'
                    )
                    """,
                    (
                        incident_id,
                        key,
                        ZERO_VECTOR,
                        token,
                    ),
                )
            conn.execute(
                """
                INSERT INTO ops.alert_deliveries (
                    message_id, resource, alert_policy, incident_key, sanitized_alert,
                    incident_id, is_owner, status, work_token
                ) VALUES (
                    %s, 'cloud_run/dev-web', 'dev-web-latency', %s, '{}',
                    %s, true, 'processing', %s
                )
                """,
                (message_b, f"key-{incident_b}", incident_b, token_b),
            )

        with pytest.raises(RuntimeError, match="delivery cas failed"):
            save_owner_analysis(
                db,
                incident_id=incident_a,
                delivery_message_id=message_b,
                investigation_token=token_a,
                work_token=token_b,
                analysis={"severity": "high", "rca_hypothesis": "crossed context"},
            )

        with db.connection() as conn:
            incident = conn.execute(
                "SELECT status FROM ops.incidents WHERE id = %s",
                (incident_a,),
            ).fetchone()
        assert incident["status"] == "investigating"
