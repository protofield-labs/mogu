from __future__ import annotations

from pathlib import Path

import pytest

from agent.playbooks import (
    DEFAULT_PLAYBOOK,
    PLAYBOOK_MAP,
    PlaybookError,
    PlaybookLoader,
)


def test_fixed_policy_map_loads_one_playbook() -> None:
    loaded = PlaybookLoader().load("dev-web-latency")

    assert loaded.name == PLAYBOOK_MAP["dev-web-latency"]
    assert "Cloud Run" in loaded.content


def test_unknown_policy_uses_default_playbook() -> None:
    loaded = PlaybookLoader().load("new-reviewed-policy")

    assert loaded.name == DEFAULT_PLAYBOOK
    assert "汎用" in loaded.content


@pytest.mark.parametrize(
    "policy",
    [
        "../cloud_run_latency.md",
        "nested/cloud_run_latency",
        r"..\cloud_run_latency",
    ],
)
def test_playbook_rejects_traversal(policy: str) -> None:
    with pytest.raises(PlaybookError, match="invalid alert policy"):
        PlaybookLoader().load(policy)


def test_playbook_rejects_symlink_escape(tmp_path: Path) -> None:
    outside = tmp_path.joinpath("outside.md")
    outside.write_text("outside", encoding="utf-8")
    root = tmp_path.joinpath("playbooks")
    root.mkdir()
    root.joinpath(DEFAULT_PLAYBOOK).symlink_to(outside)

    with pytest.raises(PlaybookError, match="escaped"):
        PlaybookLoader(root=root).load("unknown-policy")
