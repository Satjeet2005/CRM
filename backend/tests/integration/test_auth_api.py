from fastapi.testclient import TestClient

from app.config import settings
from app.seed.demo_seed import DEMO_PASSWORD


def test_login_success(client: TestClient):
    payload = {
        "email": "sales@forgeflow.demo",
        "password": DEMO_PASSWORD,
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "user" in data
    user = data["user"]
    assert user["email"] == "sales@forgeflow.demo"
    assert user["role"] == "sales_rep"
    assert "crm:read" in user["permissions"]
    assert user["organization"]["slug"] == "forgeflow-demo"

    # Verify cookies
    session_cookie = response.cookies.get(settings.SESSION_COOKIE_NAME)
    csrf_cookie = response.cookies.get(settings.CSRF_COOKIE_NAME)
    assert session_cookie is not None
    assert csrf_cookie is not None


def test_login_invalid_password_returns_generic_401(client: TestClient):
    payload = {
        "email": "sales@forgeflow.demo",
        "password": "WrongPassword123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    err = response.json()
    assert err["code"] == "INVALID_CREDENTIALS"
    assert err["message"] == "Invalid email or password"


def test_login_nonexistent_user_returns_generic_401(client: TestClient):
    payload = {
        "email": "doesnotexist@forgeflow.demo",
        "password": DEMO_PASSWORD,
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    err = response.json()
    assert err["code"] == "INVALID_CREDENTIALS"
    assert err["message"] == "Invalid email or password"


def test_auth_me_flow(client: TestClient):
    # 1. Unauthenticated /auth/me fails
    unauth_resp = client.get("/api/v1/auth/me")
    assert unauth_resp.status_code == 401

    # 2. Login
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "manager@forgeflow.demo", "password": DEMO_PASSWORD},
    )
    assert login_resp.status_code == 200
    session_token = login_resp.cookies[settings.SESSION_COOKIE_NAME]
    csrf_token = login_resp.cookies[settings.CSRF_COOKIE_NAME]

    # 3. Authenticated /auth/me succeeds
    me_resp = client.get(
        "/api/v1/auth/me",
        cookies={settings.SESSION_COOKIE_NAME: session_token},
    )
    assert me_resp.status_code == 200
    data = me_resp.json()
    assert data["user"]["email"] == "manager@forgeflow.demo"
    assert data["user"]["role"] == "sales_manager"
    assert "proposals:approve" in data["user"]["permissions"]

    # 4. Logout revokes session
    logout_resp = client.post(
        "/api/v1/auth/logout",
        cookies={
            settings.SESSION_COOKIE_NAME: session_token,
            settings.CSRF_COOKIE_NAME: csrf_token,
        },
        headers={
            "Origin": "http://testserver",
            "X-CSRF-Token": csrf_token,
        },
    )
    assert logout_resp.status_code == 200

    # 5. /auth/me fails after logout
    after_logout_resp = client.get(
        "/api/v1/auth/me",
        cookies={settings.SESSION_COOKIE_NAME: session_token},
    )
    assert after_logout_resp.status_code == 401
