from pathlib import Path
import subprocess
import sys
import re

import pytest
from sqlalchemy import create_engine

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core import startup_migrations


def test_run_startup_migrations_runs_upgrade_when_database_is_clean(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'clean.db'}")
    calls = []

    def fake_run_alembic(*args):
        calls.append(args)
        return None

    monkeypatch.setattr(startup_migrations, "_run_alembic", fake_run_alembic)

    result = startup_migrations.run_startup_migrations(bind=engine)

    assert result == "upgraded"
    assert calls == [("upgrade", "head")]


def test_run_startup_migrations_stamps_existing_schema_without_history(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    startup_migrations._load_model_metadata().create_all(bind=engine)
    calls = []

    def fake_run_alembic(*args):
        calls.append(args)
        if args == ("upgrade", "head"):
            raise subprocess.CalledProcessError(
                returncode=1,
                cmd=["alembic", *args],
                stderr="sqlite3.OperationalError: table users already exists",
            )
        return None

    monkeypatch.setattr(startup_migrations, "_run_alembic", fake_run_alembic)

    result = startup_migrations.run_startup_migrations(bind=engine)

    assert result == "stamped_head"
    assert calls == [("upgrade", "head"), ("stamp", "head")]


def test_run_startup_migrations_keeps_real_alembic_failures(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'versioned.db'}")
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
        connection.exec_driver_sql("INSERT INTO alembic_version (version_num) VALUES ('legacy-head')")
        connection.exec_driver_sql("CREATE TABLE users (id INTEGER PRIMARY KEY)")

    def fake_run_alembic(*args):
        raise subprocess.CalledProcessError(
            returncode=1,
            cmd=["alembic", *args],
            stderr="sqlite3.OperationalError: table users already exists",
        )

    monkeypatch.setattr(startup_migrations, "_run_alembic", fake_run_alembic)

    with pytest.raises(subprocess.CalledProcessError):
        startup_migrations.run_startup_migrations(bind=engine)


def test_alembic_revision_ids_fit_version_column():
    versions_dir = PROJECT_ROOT / "alembic" / "versions"
    revision_pattern = re.compile(r"^revision:\s*str\s*=\s*[\"']([^\"']+)[\"']", re.MULTILINE)

    for path in versions_dir.glob("*.py"):
        content = path.read_text(encoding="utf-8")
        match = revision_pattern.search(content)
        if match is None:
            continue
        revision = match.group(1)
        assert len(revision) <= 32, f"{path.name} revision is too long for alembic_version.version_num: {revision}"
