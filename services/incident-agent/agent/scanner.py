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


class SecretScanError(Exception):
    """A model/tool boundary could not be sanitized safely."""


class SecretScanner:
    def __init__(self, text_scanner: Callable[[str], str] = mask_string):
        self._text_scanner = text_scanner

    def sanitize_text(self, text: str) -> str:
        try:
            sanitized = self._text_scanner(text)
        except Exception as exc:
            raise SecretScanError("secret scanner failed") from exc
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

        joined_original = "\n".join(strings)
        joined_sanitized = "\n".join(sanitized_strings)
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
            return {
                self.sanitize_text(str(key)): self._sanitize_value(item)
                for key, item in value.items()
            }
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
        if cls._has_known_prefix(text):
            return True
        return any(pattern.search(text) for pattern in _RESIDUAL_PATTERNS)
