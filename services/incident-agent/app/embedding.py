from __future__ import annotations

import hashlib
import json
import math
from typing import Protocol, runtime_checkable


@runtime_checkable
class EmbeddingClient(Protocol):
    def embed(self, alert: dict) -> list[float]:
        """Return 768-dim embedding vector."""
        ...


class DeterministicEmbeddingClient:
    """Test implementation: deterministic pseudo-embedding from alert JSON."""

    def embed(self, alert: dict) -> list[float]:
        canonical = json.dumps(alert, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(canonical.encode()).digest()
        # Expand to 768 dims deterministically
        values: list[float] = []
        seed = digest
        while len(values) < 768:
            for byte in seed:
                values.append((byte / 255.0) * 2 - 1)
                if len(values) >= 768:
                    break
            seed = hashlib.sha256(seed).digest()
        # Normalize to unit vector for cosine similarity
        norm = math.sqrt(sum(v * v for v in values))
        if norm == 0:
            return values
        return [v / norm for v in values]


class VertexEmbeddingClient:
    """Production stub — raises until Vertex AI is wired in I3."""

    def __init__(self, project_id: str | None = None, model: str = "text-embedding-005"):
        self._project_id = project_id
        self._model = model

    def embed(self, alert: dict) -> list[float]:
        raise NotImplementedError(
            "VertexEmbeddingClient requires Vertex AI setup (deferred to production deploy)"
        )


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
