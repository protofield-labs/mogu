from __future__ import annotations

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
    InMemorySpanExporter,
)

from agent.scanner import SecretScanner
from app.telemetry import (
    FORBIDDEN_TRACE_MARKERS,
    InvestigationTelemetry,
    configure_telemetry,
    current_trace_id,
    investigation_run_config,
    record_investigation_summary,
    reset_for_tests,
    trace_console_url,
)
from google.adk.telemetry.context import ContentCapturingMode


def _install_memory_exporter() -> InMemorySpanExporter:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return exporter


def setup_function() -> None:
    reset_for_tests()


def test_investigation_run_config_disables_content_capture() -> None:
    config = investigation_run_config()
    assert config.telemetry is not None
    assert (
        config.telemetry.capture_message_content
        == ContentCapturingMode.NO_CONTENT
    )


def test_configure_telemetry_without_project_is_idempotent() -> None:
    configure_telemetry(project_id="", service_name="incident-agent-ingest")
    configure_telemetry(project_id="", service_name="incident-agent-ingest")


def test_record_investigation_summary_masks_secrets_in_span_attributes() -> None:
    exporter = _install_memory_exporter()
    scanner = SecretScanner()
    tracer = trace.get_tracer("test")

    with tracer.start_as_current_span("investigate"):
        trace_id = record_investigation_summary(
            scanner,
            InvestigationTelemetry(
                hypothesis=(
                    "Bearer secret-token and postgresql://user:pass@db/app"
                ),
                severity="high",
                confidence="medium",
                loop_count=2,
                token_cost=321.5,
                playbook_used="default.md",
            ),
        )

    assert trace_id is not None
    finished = exporter.get_finished_spans()
    assert len(finished) == 1
    attrs = finished[0].attributes or {}
    hypothesis = str(attrs.get("incident_agent.hypothesis", ""))
    for marker in FORBIDDEN_TRACE_MARKERS:
        assert marker not in hypothesis
    assert attrs["incident_agent.loop_count"] == 2
    assert attrs["incident_agent.token_cost"] == 321.5
    assert attrs["incident_agent.playbook_used"] == "default.md"


def test_trace_console_url_uses_cloud_console_format() -> None:
    url = trace_console_url("mogu-501309", "0af7651916cd43dd8448eb211c80319c")
    assert url is not None
    assert "console.cloud.google.com/traces/explorer" in url
    assert "traceId=0af7651916cd43dd8448eb211c80319c" in url
    assert "project=mogu-501309" in url


def test_current_trace_id_reads_active_span() -> None:
    _install_memory_exporter()
    tracer = trace.get_tracer("test")

    with tracer.start_as_current_span("root"):
        active = current_trace_id()
        assert active is not None
        assert len(active) == 32
