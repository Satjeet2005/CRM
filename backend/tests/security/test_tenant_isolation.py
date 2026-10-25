from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.session import create_session
from app.config import settings
from app.models.organization import Organization
from app.models.user import User


def test_tenant_isolation_session_bound_to_organization(client: TestClient, db_session: Session):
    # Create a secondary test organization
    other_org = Organization(
        name="Foreign Industrial Corp",
        slug="foreign-industrial",
        currency="USD",
        timezone="America/New_York",
        settings_json={},
    )
    db_session.add(other_org)
    db_session.flush()

    # User from forgeflow-demo
    user = db_session.query(User).filter(User.email_normalized == "sales@forgeflow.demo").first()
    assert user is not None

    # Artificially forge a session pointing to other_org for which user has no membership
    token, _ = create_session(db_session, user.id, other_org.id)

    # Calling /auth/me with session pointing to foreign org where user lacks membership
    # must fail with 403 Forbidden
    resp = client.get(
        "/api/v1/auth/me",
        cookies={settings.SESSION_COOKIE_NAME: token},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "ORG_MEMBERSHIP_INACTIVE"
