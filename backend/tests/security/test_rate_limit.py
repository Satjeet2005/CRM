from fastapi.testclient import TestClient

from app.auth.rate_limit import MAX_FAILED_ATTEMPTS, reset_rate_limits


def test_rate_limiting_triggers_after_repeated_failures(client: TestClient):
    reset_rate_limits()

    # Trigger failed logins up to the threshold
    for i in range(MAX_FAILED_ATTEMPTS):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "attacker@forgeflow.demo", "password": f"wrong-pass-{i}"},
        )
        assert resp.status_code == 401

    # The next attempt must be blocked by rate limiting (429)
    limited_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "attacker@forgeflow.demo", "password": "wrong-pass-exceeded"},
    )
    assert limited_resp.status_code == 429
    err = limited_resp.json()
    assert err["code"] == "RATE_LIMIT_EXCEEDED"

    reset_rate_limits()
