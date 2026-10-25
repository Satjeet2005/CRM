import secrets
from urllib.parse import urlparse

from fastapi import Request

from app.config import settings


def generate_csrf_token() -> str:
    """Generate a high-entropy random CSRF token."""
    return secrets.token_urlsafe(32)


def is_origin_allowed(origin: str | None) -> bool:
    """Check if the given origin or referer matches the configured frontend origin."""
    if not origin:
        return False

    trusted_url = urlparse(settings.FRONTEND_ORIGIN)
    origin_url = urlparse(origin)

    # In development and test environments, allow localhost/127.0.0.1 on common dev ports
    if settings.APP_ENV in {"development", "test"}:
        allowed_hosts = {"localhost", "127.0.0.1", "testserver"}
        if origin_url.hostname in allowed_hosts:
            return True

    return origin_url.scheme == trusted_url.scheme and origin_url.netloc == trusted_url.netloc


def verify_csrf(request: Request) -> bool:
    """
    Verify CSRF protection for mutating HTTP requests.
    Safe methods (GET, HEAD, OPTIONS) bypass CSRF checks.
    Mutating methods require:
    1. Origin or Referer header matching allowed frontend origin.
    2. Header X-CSRF-Token matching the CSRF cookie value.
    """
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return True

    # 1. Verify Origin / Referer
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    check_source = origin or referer

    if not check_source or not is_origin_allowed(check_source):
        return False

    # 2. Verify Double-Submit CSRF Token
    csrf_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
    csrf_header = request.headers.get("x-csrf-token")

    if not csrf_cookie or not csrf_header:
        return False

    return secrets.compare_digest(csrf_cookie, csrf_header)
