from __future__ import annotations

import math

import google.auth
from google.auth.transport import requests as google_requests

from app.embedding import (
    DeterministicEmbeddingClient,
    VertexEmbeddingClient,
    cosine_similarity,
)


def test_deterministic_embedding_is_unit_vector() -> None:
    client = DeterministicEmbeddingClient()
    vec = client.embed({"v": 1, "resource": "cloud_run/dev-web", "message": "test"})
    assert len(vec) == 768
    norm = math.sqrt(sum(v * v for v in vec))
    assert abs(norm - 1.0) < 1e-6


def test_same_input_same_embedding() -> None:
    client = DeterministicEmbeddingClient()
    alert = {"v": 1, "resource": "a", "message": "b"}
    assert client.embed(alert) == client.embed(alert)


def test_cosine_similarity_identical() -> None:
    v = [1.0, 0.0, 0.0]
    assert abs(cosine_similarity(v, v) - 1.0) < 1e-6


def test_cosine_similarity_orthogonal() -> None:
    assert abs(cosine_similarity([1.0, 0.0], [0.0, 1.0])) < 1e-6


def test_vertex_embedding_uses_predict_endpoint(monkeypatch) -> None:
    calls: dict = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "predictions": [{"embeddings": {"values": [0.25] * 768}}]
            }

    class FakeSession:
        def __init__(self, credentials) -> None:
            calls["credentials"] = credentials

        def post(self, url: str, *, json: dict, timeout: int) -> FakeResponse:
            calls.update(url=url, body=json, timeout=timeout)
            return FakeResponse()

    monkeypatch.setattr(
        google.auth,
        "default",
        lambda **kwargs: ("credentials", "discovered-project"),
    )
    monkeypatch.setattr(google_requests, "AuthorizedSession", FakeSession)

    values = VertexEmbeddingClient(
        project_id="mogu-dev",
        location="asia-northeast1",
    ).embed({"message": "latency spike"})

    assert len(values) == 768
    assert calls["url"].endswith(
        "/publishers/google/models/text-embedding-005:predict"
    )
    assert calls["body"]["instances"][0]["task_type"] == "CLUSTERING"
    assert calls["timeout"] == 30
