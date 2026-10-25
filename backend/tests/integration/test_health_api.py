from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app


def test_health_live(client: TestClient) -> None:
    resp = client.get("/health/live")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_health_ready_success(client: TestClient) -> None:
    resp = client.get("/health/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"
    assert data["migrations"] == "current"
    # Ensure no secrets, hostnames, or credentials leaked
    assert "password" not in str(data).lower()
    assert "postgres" not in str(data).lower()


def test_health_ready_database_failure(client: TestClient) -> None:
    # Override get_db with failing session
    mock_db = MagicMock()
    mock_db.execute.side_effect = Exception("Connection refused to database host")

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        resp = client.get("/health/ready")
        assert resp.status_code == 503
        data = resp.json()
        assert data["code"] == "DATABASE_UNAVAILABLE"
        assert "password" not in str(data).lower()
        assert "connection refused" not in str(data).lower()
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_health_ready_outdated_migrations(client: TestClient) -> None:
    # Mock db returning outdated revision
    mock_db = MagicMock()
    # First call SELECT 1 succeeds
    mock_db.execute.return_value.scalar.return_value = "0001_initial_foundation"

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        resp = client.get("/health/ready")
        assert resp.status_code == 503
        data = resp.json()
        assert data["code"] == "MIGRATIONS_OUTDATED"
    finally:
        app.dependency_overrides.pop(get_db, None)
