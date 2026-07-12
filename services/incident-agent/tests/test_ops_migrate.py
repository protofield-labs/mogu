from __future__ import annotations

from pathlib import Path

from jobs.ops_migrate import MIGRATION_FILES, TRACKING_TABLE_SQL, _migrations_dir


def test_migration_files_exist_on_disk() -> None:
    root = _migrations_dir()
    assert root.is_dir()
    for name in MIGRATION_FILES:
        assert (root / name).is_file(), name


def test_tracking_table_targets_public_schema() -> None:
    assert "public.incident_agent_migrations" in TRACKING_TABLE_SQL
