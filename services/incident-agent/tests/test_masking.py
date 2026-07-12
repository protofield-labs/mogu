from __future__ import annotations

import pytest

from app.masking import REDACTED, MaskingError, mask_alert, mask_string


def test_mask_bearer_token() -> None:
    text = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig"
    assert REDACTED in mask_string(text)
    assert "eyJ" not in mask_string(text)


def test_mask_email() -> None:
    assert "[REDACTED]" in mask_string("contact user@example.com please")


def test_mask_known_prefix_ghp() -> None:
    token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890"
    assert REDACTED in mask_string(f"token={token}")


def test_mask_known_prefix_xoxb() -> None:
    # Synthetic fixture — not a real Slack token (split to avoid secret scanning)
    token = "xox" + "b-" + "0000000000" + "-" + "fixture-not-real"
    assert REDACTED in mask_string(token)


def test_mask_pem_key() -> None:
    pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----"
    assert REDACTED in mask_string(pem)


def test_mask_lowercase_high_entropy() -> None:
    secret = "a" * 40
    assert REDACTED in mask_string(secret)


def test_mask_preserves_long_kebab_case_alert_policy() -> None:
    policy = "dev-incident-agent-cloud-run-latency"
    text = f"対象: cloud_run/dev-web  |  アラート: {policy}"
    assert mask_string(text) == text


def test_mask_redacts_kebab_case_secret_like_token() -> None:
    secret_like = "api-key-abcdefghijklmnopqrstuvwxyz1234567890"
    assert REDACTED in mask_string(f"bearer {secret_like}")


def test_mask_alert_preserves_safe_fields() -> None:
    alert = {
        "v": 1,
        "alert_policy": "dev-web-latency",
        "resource": "cloud_run/dev-web",
        "service": "dev-web",
        "host": None,
        "message": "error with token=ghp_abcdefghijklmnopqrstuvwxyz1234567890",
        "condition": None,
        "source_incident_id": None,
        "source_state": None,
        "started_at": None,
    }
    masked = mask_alert(alert)
    assert REDACTED in masked["message"]
    assert masked["alert_policy"] == "dev-web-latency"


def test_mask_string_too_large_fail_closed() -> None:
    with pytest.raises(MaskingError):
        mask_string("x" * (256 * 1024 + 1))
