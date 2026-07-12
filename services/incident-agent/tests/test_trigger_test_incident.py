"""Unit tests for the local E2E demo helpers (no Docker)."""

from __future__ import annotations

import base64
import json

from scripts.trigger_test_incident import _base_incident, _demo_dsn, _pubsub_envelope, _settings


def test_pubsub_envelope_roundtrip():
    incident = _base_incident()
    envelope = _pubsub_envelope("msg-demo-1", incident)
    raw = base64.b64decode(envelope["message"]["data"]).decode()
    parsed = json.loads(raw)
    assert parsed["incident"]["resource_name"] == "cloud_run/dev-web"
    assert envelope["message"]["messageId"] == "msg-demo-1"


def test_base_incident_uses_allowlisted_resource_and_policy():
    incident = _base_incident()
    assert incident["policy_name"] == "dev-web-latency"
    assert incident["resource_name"] == "cloud_run/dev-web"


def test_demo_dsn_includes_port(monkeypatch):
    monkeypatch.setenv("TEST_DB_PORT", "54329")
    dsn = _demo_dsn(_settings())
    assert "port=54329" in dsn
