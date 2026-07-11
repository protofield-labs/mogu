from __future__ import annotations

import pytest

from app.config import get_settings


def test_local_defaults_to_deterministic_embedding(monkeypatch) -> None:
    monkeypatch.delenv("NODE_ENV", raising=False)
    monkeypatch.delenv("EMBEDDING_BACKEND", raising=False)
    get_settings.cache_clear()

    assert get_settings().embedding_backend == "deterministic"
    get_settings.cache_clear()


def test_production_defaults_to_vertex_embedding(monkeypatch) -> None:
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.delenv("EMBEDDING_BACKEND", raising=False)
    get_settings.cache_clear()

    assert get_settings().embedding_backend == "vertex"
    get_settings.cache_clear()


def test_production_rejects_deterministic_embedding(monkeypatch) -> None:
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.setenv("EMBEDDING_BACKEND", "deterministic")
    get_settings.cache_clear()

    with pytest.raises(ValueError, match="production requires"):
        get_settings()
    get_settings.cache_clear()
