from __future__ import annotations

import pytest

from agent.scanner import MAX_BOUNDARY_BYTES, SecretScanError, SecretScanner
from app.masking import REDACTED


@pytest.mark.parametrize(
    "secret",
    [
        "Bearer abc.def.ghi",
        "Basic YWRtaW46c2VjcmV0",
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature",
        "postgres://admin:password@example.internal/db",
        "password=do-not-store-this",
        "AIza" + "12345678901234567890123456789012345",
        "AKIA" + "1234567890123456",
        "ghp_" + "abcdefghijklmnopqrstuvwxyz123456",
        "xoxb-" + "1234567890-abcdefghijklmnop",
        "sk-" + "abcdefghijklmnopqrstuvwxyz123456",
        "abcdefghijklmnopqrstuvwxyzABCDEF1234567890",
        "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----",
    ],
)
def test_scanner_redacts_contract_fixtures(secret: str) -> None:
    sanitized = SecretScanner().sanitize_text(f"prefix {secret} suffix")

    assert secret not in sanitized
    assert REDACTED in sanitized


def test_scanner_rejects_token_split_across_fields() -> None:
    with pytest.raises(SecretScanError):
        SecretScanner().sanitize_payload(
            {"chunks": ["gh", "p_abcdefghijklmnopqrstuv"]}
        )


def test_scanner_allows_allowlisted_trace_url_in_payload() -> None:
    trace_url = (
        "https://console.cloud.google.com/traces/explorer;traceId="
        "0af7651916cd43dd8448eb211c80319c?project=mogu-501309"
    )
    payload = {
        "hypothesis": "latency regression",
        "trace_url": trace_url,
    }
    scanner = SecretScanner()
    sanitized = scanner.sanitize_payload(payload)
    assert sanitized["trace_url"] == trace_url
    scanner.assert_safe(sanitized)


def test_scanner_allows_allowlisted_trace_url_in_rendered_text() -> None:
    from app.external import render_analysis

    trace_url = (
        "https://console.cloud.google.com/traces/explorer;traceId="
        "0af7651916cd43dd8448eb211c80319c?project=mogu-501309"
    )
    text = render_analysis(
        {"hypothesis": "latency regression", "trace_url": trace_url}
    )
    scanner = SecretScanner()
    assert trace_url in text
    scanner.assert_safe(text)


def test_scanner_fails_closed_when_detector_raises() -> None:
    def broken_scanner(value: str) -> str:
        raise RuntimeError("detector unavailable")

    with pytest.raises(SecretScanError, match="scanner failed"):
        SecretScanner(text_scanner=broken_scanner).sanitize_text("safe input")


def test_scanner_rejects_oversized_payload() -> None:
    with pytest.raises(SecretScanError, match="scan limit"):
        SecretScanner().sanitize_payload({"message": "x" * (MAX_BOUNDARY_BYTES + 1)})


def test_scanner_never_exposes_original_or_hash_in_error() -> None:
    secret = "ghp_" + "abcdefghijklmnopqrstuvwxyz123456"
    with pytest.raises(SecretScanError) as error:
        SecretScanner().assert_safe({"message": secret})

    assert secret not in str(error.value)


@pytest.mark.parametrize("text", ["asia-northeast1", "Asian service traffic"])
def test_scanner_does_not_case_fold_known_prefixes(text: str) -> None:
    assert SecretScanner().sanitize_text(text) == text
