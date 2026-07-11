from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any


def canonical_json(data: dict[str, Any]) -> str:
    """Key-sorted, compact JSON (UTF-8) per §9."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_hex(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def compute_incident_key(alert: dict[str, Any]) -> str:
    """L1 key from masked internal schema v1 fields."""
    payload = {
        "host": alert.get("host"),
        "message": alert.get("message"),
        "resource": alert["resource"],
        "service": alert.get("service"),
        "v": 1,
    }
    return sha256_hex(canonical_json(payload))


def compute_fallback_incident_key(
    *,
    message_id: str,
    resource: str,
    alert_policy: str,
    masking_error: bool = True,
) -> str:
    """Safe fallback key when masking fails (§7-10)."""
    payload = {
        "alert_policy": alert_policy,
        "masking_error": masking_error,
        "message_id": message_id,
        "resource": resource,
        "v": 1,
    }
    return sha256_hex(canonical_json(payload))


def storm_bucket_start(now: datetime | None = None) -> str:
    """UTC 5-minute bucket boundary ISO8601."""
    current = now or datetime.now(timezone.utc)
    minute = (current.minute // 5) * 5
    bucket = current.replace(minute=minute, second=0, microsecond=0)
    return bucket.isoformat()


def compute_storm_key(*, alert_policy: str, resource: str, now: datetime | None = None) -> str:
    payload = {
        "alert_policy": alert_policy,
        "bucket_start": storm_bucket_start(now),
        "kind": "storm",
        "resource": resource,
        "v": 1,
    }
    return sha256_hex(canonical_json(payload))
