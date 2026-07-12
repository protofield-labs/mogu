"""Cloud Trace and compression metrics (I5 / docs/incident-agent.md §8)."""

from __future__ import annotations

from dataclasses import dataclass
import logging
import os
from typing import Any

from agent.scanner import SecretScanner
from google.adk.agents.run_config import RunConfig
from google.adk.telemetry.context import ContentCapturingMode, TelemetryConfig

logger = logging.getLogger(__name__)

_METER: Any | None = None
_CONFIGURED = False

# Test fixtures use these markers to assert secrets never reach span attributes.
FORBIDDEN_TRACE_MARKERS = (
    "Bearer ",
    "ghp_",
    "postgresql://",
    "AIza",
)

_COUNTERS: dict[str, Any] = {}


def _env_truthy(name: str, *, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes"}


def configure_telemetry(
    *,
    project_id: str,
    service_name: str,
    enable_cloud_tracing: bool = True,
    enable_cloud_metrics: bool = True,
) -> None:
    """Programmatic ADK telemetry setup for custom Cloud Run entrypoints."""
    global _CONFIGURED, _METER
    if _CONFIGURED:
        return

    os.environ.setdefault(
        "OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT",
        "NO_CONTENT",
    )
    os.environ.setdefault("ADK_CAPTURE_MESSAGE_CONTENT_IN_SPANS", "false")
    os.environ.setdefault("OTEL_SERVICE_NAME", service_name)

    tracing_enabled = enable_cloud_tracing and _env_truthy(
        "ENABLE_CLOUD_TRACING", default=True
    )
    metrics_enabled = enable_cloud_metrics and _env_truthy(
        "ENABLE_CLOUD_METRICS", default=True
    )

    if not project_id:
        logger.info("telemetry skipped: GOOGLE_CLOUD_PROJECT is unset")
        _CONFIGURED = True
        return

    try:
        from google.adk.telemetry.google_cloud import (
            get_gcp_exporters,
            get_gcp_resource,
        )
        from google.adk.telemetry.setup import maybe_set_otel_providers
    except ImportError:
        logger.warning("ADK telemetry modules are unavailable")
        _CONFIGURED = True
        return

    hooks = get_gcp_exporters(
        enable_cloud_tracing=tracing_enabled,
        enable_cloud_metrics=metrics_enabled,
    )
    resource = get_gcp_resource(project_id=project_id)
    maybe_set_otel_providers(otel_hooks_to_setup=[hooks], otel_resource=resource)

    if metrics_enabled:
        try:
            from opentelemetry import metrics

            _METER = metrics.get_meter("incident-agent")
            _COUNTERS["alerts_received"] = _METER.create_counter(
                "incident_agent.alerts.received",
                description="Pub/Sub alerts accepted into the ingest pipeline",
            )
            _COUNTERS["incidents_opened"] = _METER.create_counter(
                "incident_agent.incidents.opened",
                description="New investigating incidents created after noise control",
            )
            _COUNTERS["issues_opened"] = _METER.create_counter(
                "incident_agent.issues.opened",
                description="GitHub issues successfully delivered from outbox",
            )
            _COUNTERS["investigations_completed"] = _METER.create_counter(
                "incident_agent.investigations.completed",
                description="LoopAgent investigations that persisted analysis",
            )
        except Exception:
            logger.warning("OpenTelemetry metrics meter setup failed", exc_info=True)

    _CONFIGURED = True


def investigation_run_config() -> RunConfig:
    """Disable GenAI prompt/tool payload capture for this invocation."""
    return RunConfig(
        telemetry=TelemetryConfig(
            capture_message_content=ContentCapturingMode.NO_CONTENT,
        ),
    )


def current_trace_id() -> str | None:
    from opentelemetry import trace

    context = trace.get_current_span().get_span_context()
    if not context.is_valid:
        return None
    return format(context.trace_id, "032x")


def trace_console_url(project_id: str, trace_id: str | None) -> str | None:
    if not project_id or not trace_id:
        return None
    return (
        "https://console.cloud.google.com/traces/explorer"
        f";traceId={trace_id}?project={project_id}"
    )


@dataclass(frozen=True)
class InvestigationTelemetry:
    hypothesis: str
    severity: str
    confidence: str
    loop_count: int
    token_cost: float
    playbook_used: str


def record_investigation_summary(
    scanner: SecretScanner,
    summary: InvestigationTelemetry,
) -> str | None:
    """Attach masked metadata to the active span. Returns the trace ID."""
    from opentelemetry import trace

    span = trace.get_current_span()
    if not span.is_recording():
        return current_trace_id()

    safe_hypothesis = scanner.sanitize_text(summary.hypothesis)
    span.set_attribute("incident_agent.hypothesis", safe_hypothesis[:500])
    span.set_attribute("incident_agent.severity", summary.severity)
    span.set_attribute("incident_agent.confidence", summary.confidence)
    span.set_attribute("incident_agent.loop_count", summary.loop_count)
    span.set_attribute("incident_agent.token_cost", float(summary.token_cost))
    span.set_attribute("incident_agent.playbook_used", summary.playbook_used)
    return current_trace_id()


def record_alert_received() -> None:
    counter = _COUNTERS.get("alerts_received")
    if counter is not None:
        counter.add(1)


def record_incident_opened() -> None:
    counter = _COUNTERS.get("incidents_opened")
    if counter is not None:
        counter.add(1)


def record_issue_opened() -> None:
    counter = _COUNTERS.get("issues_opened")
    if counter is not None:
        counter.add(1)


def record_investigation_completed(*, severity: str, confidence: str) -> None:
    counter = _COUNTERS.get("investigations_completed")
    if counter is not None:
        counter.add(
            1,
            attributes={
                "severity": severity,
                "confidence": confidence,
            },
        )


def reset_for_tests() -> None:
    """Clear module state between telemetry unit tests."""
    global _CONFIGURED, _METER
    _CONFIGURED = False
    _METER = None
    _COUNTERS.clear()
