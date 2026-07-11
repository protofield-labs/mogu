from __future__ import annotations

from app.db import advisory_lock_key, storm_advisory_lock_key
from app.keys import sha256_hex


def test_advisory_lock_key_is_deterministic() -> None:
    key1 = advisory_lock_key("cloud_run/dev-web", "dev-web-latency")
    key2 = advisory_lock_key("cloud_run/dev-web", "dev-web-latency")
    assert key1 == key2
    assert key1 >= 0


def test_advisory_lock_key_differs_by_resource() -> None:
    a = advisory_lock_key("cloud_run/a", "policy")
    b = advisory_lock_key("cloud_run/b", "policy")
    assert a != b


def test_storm_advisory_lock_key_is_deterministic() -> None:
    storm_key = sha256_hex("test-storm")
    assert storm_advisory_lock_key(storm_key) == storm_advisory_lock_key(storm_key)
