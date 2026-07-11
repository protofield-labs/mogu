from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass
class RequestDeadline:
    started_at: float
    absolute_deadline_seconds: int

    @classmethod
    def create(cls, absolute_deadline_seconds: int = 540) -> RequestDeadline:
        return cls(time.monotonic(), absolute_deadline_seconds)

    def remaining_seconds(self) -> float:
        elapsed = time.monotonic() - self.started_at
        return self.absolute_deadline_seconds - elapsed

    def expired(self) -> bool:
        return self.remaining_seconds() <= 0

    def loop_agent_budget_seconds(self) -> float:
        """min(270, absolute_deadline - now - 30) per §7-6."""
        remaining = self.remaining_seconds() - 30
        return max(0.0, min(270.0, remaining))

    def ensure_not_expired(self) -> None:
        if self.expired():
            raise DeadlineExceeded()


class DeadlineExceeded(Exception):
    """Request absolute deadline exceeded."""


def new_token() -> uuid.UUID:
    return uuid.uuid4()


def lease_expires_at(seconds: int = 600) -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=seconds)
