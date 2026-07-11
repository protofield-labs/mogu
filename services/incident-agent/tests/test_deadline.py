from __future__ import annotations

import time

import pytest

from app.deadline import DeadlineExceeded, RequestDeadline


def test_deadline_remaining() -> None:
    d = RequestDeadline(started_at=time.monotonic(), absolute_deadline_seconds=10)
    assert d.remaining_seconds() <= 10
    assert d.remaining_seconds() > 9


def test_deadline_expired() -> None:
    d = RequestDeadline(started_at=time.monotonic() - 20, absolute_deadline_seconds=10)
    assert d.expired()


def test_loop_agent_budget_capped_at_270() -> None:
    d = RequestDeadline(started_at=time.monotonic(), absolute_deadline_seconds=540)
    assert d.loop_agent_budget_seconds() <= 270


def test_loop_agent_budget_preserves_commit_buffer() -> None:
    d = RequestDeadline(started_at=time.monotonic() - 30, absolute_deadline_seconds=100)
    assert 39 < d.loop_agent_budget_seconds() <= 40


def test_loop_agent_budget_is_zero_inside_commit_buffer() -> None:
    d = RequestDeadline(started_at=time.monotonic() - 80, absolute_deadline_seconds=100)
    assert d.loop_agent_budget_seconds() == 0


def test_ensure_not_expired_raises() -> None:
    d = RequestDeadline(started_at=time.monotonic() - 600, absolute_deadline_seconds=10)
    with pytest.raises(DeadlineExceeded):
        d.ensure_not_expired()
