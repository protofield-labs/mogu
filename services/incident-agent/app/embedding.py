from __future__ import annotations

import hashlib
import json
import math
import re
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
    """Vertex AI text embedding client used by production ingest."""

    def __init__(
        self,
        project_id: str,
        location: str = "asia-northeast1",
        model: str = "text-embedding-005",
    ):
        identifier = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
        if not project_id or not identifier.fullmatch(project_id):
            raise ValueError("valid Google Cloud project_id is required")
        if not identifier.fullmatch(location) or not identifier.fullmatch(model):
            raise ValueError("invalid Vertex AI location or model")
        self._project_id = project_id
        self._location = location
        self._model = model

    def embed(self, alert: dict) -> list[float]:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession

        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        session = AuthorizedSession(credentials)
        endpoint = (
            f"https://{self._location}-aiplatform.googleapis.com/v1/"
            f"projects/{self._project_id}/locations/{self._location}/"
            f"publishers/google/models/{self._model}:predict"
        )
        content = json.dumps(alert, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        response = session.post(
            endpoint,
            json={
                "instances": [{"content": content, "task_type": "CLUSTERING"}],
                "parameters": {"outputDimensionality": 768},
            },
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        try:
            raw_values = payload["predictions"][0]["embeddings"]["values"]
            values = [float(value) for value in raw_values]
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise RuntimeError("invalid Vertex embedding response") from exc
        if len(values) != 768 or not all(math.isfinite(value) for value in values):
            raise RuntimeError("Vertex embedding must contain 768 finite values")
        return values


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
