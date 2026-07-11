from __future__ import annotations

import pytest

from app.adapter import adapt_monitoring_payload
from app.masking import mask_alert

ALLOWED_RESOURCES = frozenset({"cloud_run/dev-web", "cloud_sql/prod-db"})
ALLOWED_POLICIES = frozenset({"dev-web-latency", "cloud-sql-connections"})


@pytest.fixture
def monitoring_payload_v1() -> dict:
    return {
        "incident": {
            "policy_name": "dev-web-latency",
            "resource_name": "cloud_run/dev-web",
            "summary": "Cloud Run latency p99 exceeded threshold",
            "condition_name": "latency-p99",
            "incident_id": "inc-12345",
            "state": "open",
            "started_at": "2026-03-12T10:00:00Z",
            "resource": {
                "type": "cloud_run_revision",
                "labels": {
                    "project_id": "mogu-dev",
                    "location": "asia-northeast1",
                    "service_name": "dev-web",
                },
            },
        }
    }


def test_adapter_produces_canonical_schema(monitoring_payload_v1: dict) -> None:
    adapted = adapt_monitoring_payload(
        monitoring_payload_v1,
        allowed_resources=ALLOWED_RESOURCES,
        allowed_alert_policies=ALLOWED_POLICIES,
    )
    alert = adapted.to_dict()
    assert alert["v"] == 1
    assert alert["alert_policy"] == "dev-web-latency"
    assert alert["resource"] == "cloud_run/dev-web"
    assert alert["service"] == "dev-web"
    assert alert["message"] == "Cloud Run latency p99 exceeded threshold"
    assert alert["condition"] == "latency-p99"
    assert alert["source_incident_id"] == "inc-12345"
    assert alert["source_state"] == "open"
    assert alert["started_at"] == "2026-03-12T10:00:00Z"


def test_adapter_rejects_unknown_incident_field(monitoring_payload_v1: dict) -> None:
    payload = {**monitoring_payload_v1}
    payload["incident"] = {**monitoring_payload_v1["incident"], "extra_field": "x"}
    with pytest.raises(Exception):
        adapt_monitoring_payload(
            payload,
            allowed_resources=ALLOWED_RESOURCES,
            allowed_alert_policies=ALLOWED_POLICIES,
        )


def test_adapter_rejects_disallowed_resource(monitoring_payload_v1: dict) -> None:
    payload = {**monitoring_payload_v1}
    payload["incident"] = {**monitoring_payload_v1["incident"], "resource_name": "cloud_run/other"}
    with pytest.raises(Exception):
        adapt_monitoring_payload(
            payload,
            allowed_resources=ALLOWED_RESOURCES,
            allowed_alert_policies=ALLOWED_POLICIES,
        )


def test_adapter_label_priority_for_service_and_host() -> None:
    payload = {
        "incident": {
            "policy_name": "cloud-sql-connections",
            "resource_name": "cloud_sql/prod-db",
            "resource": {
                "type": "cloud_sql_database",
                "labels": {
                    "project_id": "mogu",
                    "service": "fallback-service",
                    "service_name": "primary-service",
                    "instance_id": "inst-1",
                    "instance_name": "inst-name",
                    "host": "10.0.0.1",
                },
            },
        }
    }
    adapted = adapt_monitoring_payload(
        payload,
        allowed_resources=ALLOWED_RESOURCES,
        allowed_alert_policies=ALLOWED_POLICIES,
    )
    assert adapted.service == "primary-service"
    assert adapted.host == "10.0.0.1"


def test_masked_alert_matches_internal_schema(monitoring_payload_v1: dict) -> None:
    adapted = adapt_monitoring_payload(
        monitoring_payload_v1,
        allowed_resources=ALLOWED_RESOURCES,
        allowed_alert_policies=ALLOWED_POLICIES,
    )
    masked = mask_alert(adapted.to_dict())
    assert set(masked.keys()) == {
        "v",
        "alert_policy",
        "resource",
        "service",
        "host",
        "message",
        "condition",
        "source_incident_id",
        "source_state",
        "started_at",
    }
