import os
from collections.abc import Generator

import pytest
import sqlalchemy as sa
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from alembic import command
from app.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.seed.demo_seed import seed_demo_data

# STRICT SAFETY CHECK:
# Test database URL must be configured, must not equal DATABASE_URL, and must contain '_test'
test_db_url = settings.TEST_DATABASE_URL
if not test_db_url or test_db_url == settings.DATABASE_URL or "_test" not in test_db_url:
    raise RuntimeError(
        f"SAFETY VIOLATION: Refusing to run tests. TEST_DATABASE_URL ('{test_db_url}') "
        f"must be separate from DATABASE_URL and contain '_test'."
    )

test_engine = create_engine(test_db_url, pool_pre_ping=True)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def apply_migrations():
    """Apply Alembic migrations to the test database once per session."""
    os.environ["DATABASE_URL"] = test_db_url
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", test_db_url)

    # Clean drop public schema to reset all migration state cleanly
    with test_engine.begin() as conn:
        conn.execute(sa.text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))

    command.upgrade(alembic_cfg, "head")
    yield
    with test_engine.begin() as conn:
        conn.execute(sa.text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """Provide a clean test DB session with seed data for each test."""
    db = TestSessionLocal()
    # Clean tables in reverse dependency order
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()

    # Seed demo users for tests
    seed_demo_data(db)

    try:
        yield db
    finally:
        db.rollback()
        db.close()


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """FastAPI TestClient with overridden get_db dependency."""

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, base_url="http://testserver") as c:
        yield c
    app.dependency_overrides.clear()
