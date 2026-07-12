from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

# Known credential prefixes (§7-10)
KNOWN_PREFIXES = (
    "AIza",
    "AKIA",
    "ASIA",
    "ghp_",
    "gho_",
    "ghu_",
    "ghs_",
    "ghr_",
    "xoxb-",
    "xoxp-",
    "xoxa-",
    "xoxr-",
    "xoxs-",
    "sk-",
)

REDACTED = "[REDACTED]"

# Patterns for masking
_BEARER = re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE)
_BASIC = re.compile(r"Basic\s+[A-Za-z0-9+/]+=*", re.IGNORECASE)
_JWT = re.compile(r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")
_COOKIE = re.compile(
    r"(?i)(cookie|set-cookie|session|sid)\s*[=:]\s*[^\s;,\"']+"
)
_EMAIL = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_CRED_URI = re.compile(
    r"[a-zA-Z][a-zA-Z0-9+.-]*://[^/\s:@]+:[^@\s/]+@[^\s\"']+"
)
_PEM = re.compile(
    r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"
)
_CONN_STRING = re.compile(
    r"(?i)(?:password|pwd|secret|token|api[_-]?key)\s*=\s*[^\s;\"']+"
)
_ASSIGNMENT = re.compile(
    r"(?i)(?:secret|password|passwd|token|api[_-]?key)\s*[:=]\s*['\"]?[^\s'\",;]+"
)
_HIGH_ENTROPY = re.compile(r"\b[A-Za-z0-9_\-]{32,}\b")
# Long kebab-case alert policy names (4+ segments) are operational IDs, not secrets.
_OPERATIONAL_ALERT_POLICY = re.compile(r"^[a-z][a-z0-9]*(?:-[a-z0-9]+){3,}$")

# Safe metadata keys that may contain longer strings
_SAFE_KEYS = frozenset(
    {
        "alert_policy",
        "resource",
        "service",
        "host",
        "message",
        "condition",
        "source_incident_id",
        "source_state",
        "started_at",
        "v",
        "incident_id",
        "policy_name",
        "resource_name",
        "resource_type",
        "summary",
        "condition_name",
        "state",
        "type",
        "project_id",
        "location",
        "region",
        "zone",
        "service_name",
        "instance_name",
        "instance_id",
    }
)

_MAX_SCAN_BYTES = 256 * 1024


class MaskingError(Exception):
    """Raised when masking fails closed."""


@dataclass(frozen=True)
class MaskingResult:
    value: str
    had_redactions: bool


def _scan_text(text: str) -> MaskingResult:
    if len(text.encode("utf-8")) > _MAX_SCAN_BYTES:
        raise MaskingError("text exceeds scan limit")

    original = text
    had = False

    for pattern in (
        _PEM,
        _BEARER,
        _BASIC,
        _JWT,
        _CRED_URI,
        _CONN_STRING,
        _ASSIGNMENT,
        _COOKIE,
        _EMAIL,
    ):
        if pattern.search(text):
            text = pattern.sub(REDACTED, text)
            had = True

    for prefix in KNOWN_PREFIXES:
        idx = text.find(prefix)
        while idx != -1:
            end = idx + len(prefix)
            while end < len(text) and text[end] not in " \t\n\r\"',;<>()[]{}":
                end += 1
            text = text[:idx] + REDACTED + text[end:]
            had = True
            idx = text.find(prefix, idx + len(REDACTED))

    def entropy_replacer(match: re.Match[str]) -> str:
        token = match.group(0)
        if token in _SAFE_KEYS:
            return token
        if _OPERATIONAL_ALERT_POLICY.fullmatch(token):
            return token
        return REDACTED

    new_text, count = _HIGH_ENTROPY.subn(entropy_replacer, text)
    if count:
        had = True
    text = new_text

    if REDACTED in text and _residual_scan(text):
        raise MaskingError("residual sensitive pattern after masking")

    if text != original:
        had = True

    return MaskingResult(value=text, had_redactions=had)


def _residual_scan(text: str) -> bool:
    """Detect if sensitive patterns remain after redaction."""
    checks = (
        _PEM,
        _BEARER,
        _JWT,
        _CRED_URI,
        _PEM,
    )
    for pattern in checks:
        if pattern.search(text):
            return True
    for prefix in KNOWN_PREFIXES:
        if prefix in text and REDACTED not in text[text.find(prefix) : text.find(prefix) + 64]:
            return True
    return False


def mask_string(value: str) -> str:
    return _scan_text(value).value


def mask_alert(alert: dict[str, Any]) -> dict[str, Any]:
    """Mask string fields in internal schema v1 alert."""
    result: dict[str, Any] = {}
    for key, value in alert.items():
        if key not in _SAFE_KEYS and key != "v":
            continue
        if value is None:
            result[key] = None
        elif isinstance(value, str):
            result[key] = mask_string(value)
        elif isinstance(value, (int, float, bool)):
            result[key] = value
        else:
            raise MaskingError(f"unsupported field type: {key}")
    result["v"] = 1
    required = ("alert_policy", "resource")
    for field in required:
        if field not in result:
            raise MaskingError(f"missing required field: {field}")
    return result


def mask_log_lines(lines: list[str]) -> list[str]:
    return [mask_string(line) for line in lines]
