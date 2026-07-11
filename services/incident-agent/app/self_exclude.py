from __future__ import annotations

from app.config import Settings


def is_self_excluded(resource: str, settings: Settings) -> bool:
    """§7-2: skip investigation for incident-agent resources."""
    for prefix in settings.self_exclude_resource_prefixes:
        if resource.startswith(prefix) or f"/{prefix}" in resource:
            return True
    return False
