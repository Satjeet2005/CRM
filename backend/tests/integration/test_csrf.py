from fastapi.testclient import TestClient

from app.config import settings
from app.seed.demo_seed import DEMO_PASSWORD


def test_logout_csrf_protection(client: TestClient):
    # Log in first
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "sales@forgeflow.demo", "password": DEMO_PASSWORD},
    )
    assert login_resp.status_code == 200
    session_token = login_resp.cookies[settings.SESSION_COOKIE_NAME]
    csrf_token = login_resp.cookies[settings.CSRF_COOKIE_NAME]

    # Attempt logout without CSRF header (should fail with 403)
    resp_no_csrf = client.post(
        "/api/v1/auth/logout",
        cookies={
            settings.SESSION_COOKIE_NAME: session_token,
            settings.CSRF_COOKIE_NAME: csrf_token,
        },
        headers={"Origin": "http://testserver"},
    )
    assert resp_no_csrf.status_code == 403
    assert resp_no_csrf.json()["code"] == "CSRF_ERROR"

    # Attempt logout with forged/mismatched CSRF header (should fail with 403)
    resp_bad_csrf = client.post(
        "/api/v1/auth/logout",
        cookies={
            settings.SESSION_COOKIE_NAME: session_token,
            settings.CSRF_COOKIE_NAME: csrf_token,
        },
        headers={
            "Origin": "http://testserver",
            "X-CSRF-Token": "forged-token-value",
        },
    )
    assert resp_bad_csrf.status_code == 403

    # Attempt logout from untrusted origin (should fail with 403)
    resp_bad_origin = client.post(
        "/api/v1/auth/logout",
        cookies={
            settings.SESSION_COOKIE_NAME: session_token,
            settings.CSRF_COOKIE_NAME: csrf_token,
        },
        headers={
            "Origin": "https://malicious-site.attacker.example",
            "X-CSRF-Token": csrf_token,
        },
    )
    assert resp_bad_origin.status_code == 403

    # Logout with valid Origin and valid CSRF token succeeds
    resp_success = client.post(
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
    assert resp_success.status_code == 200
