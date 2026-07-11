from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.masking import MaskingError, mask_string


class AdapterError(Exception):
    """Monitoring payload could not be adapted."""


ALLOWED_INCIDENT_PATHS = frozenset(
    {
        "policy_name",
        "resource_name",
        "resource.type",
        "resource.labels.project_id",
        "resource.labels.location",
        "resource.labels.region",
        "resource.labels.zone",
        "resource.labels.service_name",
        "resource.labels.service",
        "resource.labels.host",
        "resource.labels.instance_name",
        "resource.labels.instance_id",
        "summary",
        "condition_name",
        "incident_id",
        "state",
        "started_at",
    }
)

_MAX_FIELD_LEN = 4096


@dataclass(frozen=True)
class AdaptedAlert:
    alert_policy: str
    resource: str
    service: str | None
    host: str | None
    message: str | None
    condition: str | None
    source_incident_id: str | None
    source_state: str | None
    started_at: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "v": 1,
            "alert_policy": self.alert_policy,
            "resource": self.resource,
            "service": self.service,
            "host": self.host,
            "message": self.message,
            "condition": self.condition,
            "source_incident_id": self.source_incident_id,
            "source_state": self.source_state,
            "started_at": self.started_at,
        }


def _get_nested(data: dict[str, Any], path: str) -> Any:
    parts = path.split(".")
    current: Any = data
    for part in parts:
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _validate_str(value: Any, field: str, *, required: bool = False) -> str | None:
    if value is None:
        if required:
            raise AdapterError(f"missing required field: {field}")
        return None
    if not isinstance(value, str):
        raise AdapterError(f"invalid type for {field}")
    if len(value) > _MAX_FIELD_LEN:
        raise AdapterError(f"field too long: {field}")
    return value


def _normalize_resource(
    incident: dict[str, Any],
    allowed_resources: frozenset[str],
) -> str:
    resource_name = _validate_str(incident.get("resource_name"), "resource_name")
    if resource_name and resource_name in allowed_resources:
        return resource_name

    resource = incident.get("resource")
    if not isinstance(resource, dict):
        raise AdapterError("missing resource")

    resource_type = _validate_str(resource.get("type"), "resource.type", required=True)
    labels = resource.get("labels")
    if not isinstance(labels, dict):
        raise AdapterError("missing resource.labels")

    candidates: list[str] = []
    project_id = labels.get("project_id", "")
    location = labels.get("location") or labels.get("region") or labels.get("zone") or ""
    service = labels.get("service_name") or labels.get("service") or ""
    host = labels.get("host") or labels.get("instance_name") or labels.get("instance_id") or ""

    if service:
        candidates.append(f"{resource_type}/{project_id}/{location}/{service}".strip("/"))
    if host:
        candidates.append(f"{resource_type}/{project_id}/{location}/{host}".strip("/"))
    candidates.append(f"{resource_type}/{project_id}/{location}".strip("/"))

    for candidate in candidates:
        normalized = "/".join(part for part in candidate.split("/") if part)
        if normalized in allowed_resources:
            return normalized

    raise AdapterError("resource not in allowlist")


def _normalize_alert_policy(policy_name: str | None, allowed: frozenset[str]) -> str:
    if not policy_name or policy_name not in allowed:
        raise AdapterError("alert_policy not in allowlist")
    return policy_name


def _first_label(labels: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = labels.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def adapt_monitoring_payload(
    payload: dict[str, Any],
    *,
    allowed_resources: frozenset[str],
    allowed_alert_policies: frozenset[str],
) -> AdaptedAlert:
    """Fixed adapter for Cloud Monitoring notification schema v1 (§9)."""
    if not isinstance(payload, dict):
        raise AdapterError("payload must be object")

    incident = payload.get("incident")
    if not isinstance(incident, dict):
        raise AdapterError("missing incident")

    # Reject unknown top-level fields in incident (allowlist enforcement)
    known_incident_keys = {
        "policy_name",
        "resource_name",
        "resource",
        "summary",
        "condition_name",
        "incident_id",
        "state",
        "started_at",
    }
    for key in incident:
        if key not in known_incident_keys:
            raise AdapterError(f"unknown incident field: {key}")

    alert_policy = _normalize_alert_policy(
        _validate_str(incident.get("policy_name"), "policy_name", required=True),
        allowed_alert_policies,
    )
    resource = _normalize_resource(incident, allowed_resources)

    labels: dict[str, Any] = {}
    resource_obj = incident.get("resource")
    if isinstance(resource_obj, dict) and isinstance(resource_obj.get("labels"), dict):
        labels = resource_obj["labels"]
        for key in labels:
            if key not in {
                "project_id",
                "location",
                "region",
                "zone",
                "service_name",
                "service",
                "host",
                "instance_name",
                "instance_id",
            }:
                raise AdapterError(f"unknown resource label: {key}")

    service = _first_label(labels, "service_name", "service")
    host = _first_label(labels, "host", "instance_name", "instance_id")

    summary = _validate_str(incident.get("summary"), "summary")
    message: str | None = None
    if summary:
        try:
            message = mask_string(summary)
        except MaskingError as exc:
            raise AdapterError(f"summary masking failed: {exc}") from exc

    return AdaptedAlert(
        alert_policy=alert_policy,
        resource=resource,
        service=service,
        host=host,
        message=message,
        condition=_validate_str(incident.get("condition_name"), "condition_name"),
        source_incident_id=_validate_str(incident.get("incident_id"), "incident_id"),
        source_state=_validate_str(incident.get("state"), "state"),
        started_at=_validate_str(incident.get("started_at"), "started_at"),
    )
