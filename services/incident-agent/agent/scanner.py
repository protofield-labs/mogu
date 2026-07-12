from __future__ import annotations

import json
import re
from typing import Any, Callable

from app.masking import KNOWN_PREFIXES, REDACTED, mask_string

MAX_BOUNDARY_BYTES = 256 * 1024

_RESIDUAL_PATTERNS = (
    re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE),
    re.compile(r"Basic\s+[A-Za-z0-9+/]+=*", re.IGNORECASE),
    re.compile(r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", re.IGNORECASE),
    re.compile(r"[a-zA-Z][a-zA-Z0-9+.-]*://[^/\s:@]+:[^@\s/]+@", re.IGNORECASE),
    re.compile(
        r"(?:secret|password|passwd|token|api[_-]?key)\s*[:=]\s*"
        r"(?!\[REDACTED\])['\"]?[^\s'\",;]+",
        re.IGNORECASE,
    ),
    re.compile(r"\b[A-Za-z0-9_-]{32,}\b"),
)

# Must match trace_console_url() output exactly: fixed path, 32-hex trace ID,
# and a GCP project ID (lowercase letters, digits, hyphens). Anything looser
# would let attacker-crafted URLs smuggle secrets past the masking boundary.
_ALLOWLISTED_TRACE_URL = re.compile(
    r"https://console\.cloud\.google\.com/traces/explorer"
    r";traceId=[0-9a-f]{32}\?project=[a-z][a-z0-9-]{4,29}"
)
_OPERATIONAL_KEBAB = re.compile(r"\b[a-z][a-z0-9]*(?:-[a-z0-9]+){3,}\b")
_OPERATIONAL_RESOURCE = re.compile(r"\bcloud_run/[a-z0-9_-]+\b")


def _scrub_operational_identifiers(text: str) -> str:
    text = _OPERATIONAL_RESOURCE.sub("[RESOURCE]", text)
    return _OPERATIONAL_KEBAB.sub("[POLICY]", text)


class SecretScanError(Exception):
    """A model/tool boundary could not be sanitized safely."""


class SecretScanner:
    def __init__(self, text_scanner: Callable[[str], str] = mask_string):
        self._text_scanner = text_scanner

    def sanitize_text(self, text: str) -> str:
        preserved: list[str] = []

        def stash(match: re.Match[str]) -> str:
            url = match.group(0)
            if self._has_known_prefix(url):
                return url
            preserved.append(url)
            return f"\x00TRACE_{len(preserved) - 1}\x00"

        stashed = _ALLOWLISTED_TRACE_URL.sub(stash, text)
        try:
            sanitized = self._text_scanner(stashed)
        except Exception as exc:
            raise SecretScanError("secret scanner failed") from exc
        for index, url in enumerate(preserved):
            sanitized = sanitized.replace(f"\x00TRACE_{index}\x00", url)
        if self._has_residual(sanitized):
            raise SecretScanError("residual secret detected")
        return sanitized

    def sanitize_payload(self, value: Any) -> Any:
        try:
            encoded = json.dumps(
                value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
            )
        except (TypeError, ValueError) as exc:
            raise SecretScanError("payload is not JSON serializable") from exc
        if len(encoded.encode("utf-8")) > MAX_BOUNDARY_BYTES:
            raise SecretScanError("payload exceeds scan limit")

        strings = list(self._iter_strings(value))
        sanitized = self._sanitize_value(value)
        sanitized_strings = list(self._iter_strings(sanitized))

        joined_original = "\n".join(
            _scrub_allowlisted_trace_urls(item) for item in strings
        )
        joined_sanitized = "\n".join(
            _scrub_allowlisted_trace_urls(item) for item in sanitized_strings
        )
        if strings:
            combined = self.sanitize_text(joined_original)
            if combined != joined_original and REDACTED not in joined_sanitized:
                raise SecretScanError("secret split across payload fields")

        compacted = re.sub(r"[\s\"',:\[\]{}]+", "", joined_sanitized)
        if self._has_known_prefix(compacted) or self._has_residual(joined_sanitized):
            raise SecretScanError("residual secret detected after payload scan")
        return sanitized

    def assert_safe(self, value: Any) -> None:
        if self.sanitize_payload(value) != value:
            raise SecretScanError("unsanitized model input")

    def _sanitize_value(self, value: Any) -> Any:
        if isinstance(value, str):
            return self.sanitize_text(value)
        if isinstance(value, list):
            return [self._sanitize_value(item) for item in value]
        if isinstance(value, dict):
            sanitized: dict[str, Any] = {}
            for key, item in value.items():
                safe_key = self.sanitize_text(str(key))
                if (
                    safe_key == "trace_url"
                    and isinstance(item, str)
                    and _is_allowlisted_trace_url(item)
                ):
                    sanitized[safe_key] = item
                else:
                    sanitized[safe_key] = self._sanitize_value(item)
            return sanitized
        if value is None or isinstance(value, (bool, int, float)):
            return value
        raise SecretScanError("unsupported payload type")

    @staticmethod
    def _iter_strings(value: Any):
        if isinstance(value, str):
            yield value
        elif isinstance(value, list):
            for item in value:
                yield from SecretScanner._iter_strings(item)
        elif isinstance(value, dict):
            for key, item in value.items():
                yield str(key)
                yield from SecretScanner._iter_strings(item)

    @staticmethod
    def _has_known_prefix(text: str) -> bool:
        return any(prefix in text for prefix in KNOWN_PREFIXES)

    @classmethod
    def _has_residual(cls, text: str) -> bool:
        scrubbed = _scrub_operational_identifiers(
            _scrub_allowlisted_trace_urls(text)
        )
        if cls._has_known_prefix(scrubbed):
            return True
        return any(pattern.search(scrubbed) for pattern in _RESIDUAL_PATTERNS)


def _is_allowlisted_trace_url(value: str) -> bool:
    candidate = value.strip()
    if _ALLOWLISTED_TRACE_URL.fullmatch(candidate) is None:
        return False
    return not SecretScanner._has_known_prefix(candidate)


def _scrub_allowlisted_trace_urls(text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        url = match.group(0)
        if SecretScanner._has_known_prefix(url):
            return url
        return "[TRACE_LINK]"

    return _ALLOWLISTED_TRACE_URL.sub(replace, text)
