from __future__ import annotations

import math

from app.embedding import DeterministicEmbeddingClient, cosine_similarity


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
