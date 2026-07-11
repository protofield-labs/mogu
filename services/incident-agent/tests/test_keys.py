from __future__ import annotations

from app.keys import (
    canonical_json,
    compute_fallback_incident_key,
    compute_incident_key,
    compute_storm_key,
    sha256_hex,
    storm_bucket_start,
)


def test_incident_key_canonical_order() -> None:
    alert = {
        "v": 1,
        "alert_policy": "dev-web-latency",
        "resource": "cloud_run/dev-web",
        "service": "dev-web",
        "host": None,
        "message": "latency spike",
    }
    key = compute_incident_key(alert)
    expected_payload = {
        "host": None,
        "message": "latency spike",
        "resource": "cloud_run/dev-web",
        "service": "dev-web",
        "v": 1,
    }
    assert key == sha256_hex(canonical_json(expected_payload))


def test_incident_key_differs_by_resource() -> None:
    base = {
        "v": 1,
        "alert_policy": "p",
        "resource": "cloud_run/a",
        "service": None,
        "host": None,
        "message": "same",
    }
    other = {**base, "resource": "cloud_run/b"}
    assert compute_incident_key(base) != compute_incident_key(other)


def test_storm_key_includes_bucket() -> None:
    from datetime import datetime, timezone

    fixed = datetime(2026, 3, 12, 10, 7, 30, tzinfo=timezone.utc)
    key = compute_storm_key(
        alert_policy="dev-web-latency", resource="cloud_run/dev-web", now=fixed
    )
    bucket = storm_bucket_start(fixed)
    payload = {
        "alert_policy": "dev-web-latency",
        "bucket_start": bucket,
        "kind": "storm",
        "resource": "cloud_run/dev-web",
        "v": 1,
    }
    assert key == sha256_hex(canonical_json(payload))
    assert bucket.endswith("T10:05:00+00:00")


def test_fallback_incident_key_on_masking_error() -> None:
    key1 = compute_fallback_incident_key(
        message_id="msg-1", resource="cloud_run/dev-web", alert_policy="dev-web-latency"
    )
    key2 = compute_fallback_incident_key(
        message_id="msg-2", resource="cloud_run/dev-web", alert_policy="dev-web-latency"
    )
    assert key1 != key2
