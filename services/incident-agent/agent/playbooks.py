from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from agent.scanner import SecretScanner

PLAYBOOK_MAP = {
    "dev-web-latency": "cloud_run_latency.md",
    "cloud-run-latency": "cloud_run_latency.md",
    "dev-cloud-run-latency": "cloud_run_latency.md",
    "dev-cloud-run-5xx": "error_rate_spike.md",
    "dev-incident-agent-cloud-run-latency": "cloud_run_latency.md",
    "dev-incident-agent-cloud-run-5xx": "error_rate_spike.md",
    "cloud-sql-connections": "cloud_sql_connections.md",
    "error-rate-spike": "error_rate_spike.md",
}
DEFAULT_PLAYBOOK = "default.md"
MAX_PLAYBOOK_BYTES = 32 * 1024


class PlaybookError(Exception):
    """A playbook could not be resolved inside the trusted directory."""


@dataclass(frozen=True)
class LoadedPlaybook:
    name: str
    content: str


class PlaybookLoader:
    def __init__(
        self,
        root: Path | None = None,
        scanner: SecretScanner | None = None,
    ):
        self._root = (
            root
            or Path(__file__).resolve().parent.parent.joinpath("playbooks")
        ).resolve()
        self._scanner = scanner or SecretScanner()

    def load(self, alert_policy: str) -> LoadedPlaybook:
        if any(part in alert_policy for part in ("..", "/", "\\")):
            raise PlaybookError("invalid alert policy")
        filename = PLAYBOOK_MAP.get(alert_policy, DEFAULT_PLAYBOOK)
        candidate = self._root.joinpath(filename).resolve()
        try:
            candidate.relative_to(self._root)
        except ValueError as exc:
            raise PlaybookError("playbook escaped trusted directory") from exc
        if not candidate.is_file():
            raise PlaybookError("playbook is missing")
        if candidate.stat().st_size > MAX_PLAYBOOK_BYTES:
            raise PlaybookError("playbook exceeds size limit")

        content = candidate.read_text(encoding="utf-8")
        sanitized = self._scanner.sanitize_text(content)
        return LoadedPlaybook(name=filename, content=sanitized)
