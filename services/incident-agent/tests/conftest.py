from __future__ import annotations

import os
import subprocess
import sys

import pytest

# Ensure app package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def _docker_pg_available() -> bool:
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            timeout=5,
            check=False,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


requires_docker_pg = pytest.mark.skipif(
    not _docker_pg_available(),
    reason="Docker not available for integration tests",
)
