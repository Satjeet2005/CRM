import time
from collections import defaultdict
from threading import Lock

# Simple thread-safe in-memory rate limiter for login attempts
_LOCK = Lock()
_ATTEMPTS: dict[str, list[float]] = defaultdict(list)

MAX_FAILED_ATTEMPTS = 5
WINDOW_SECONDS = 300.0  # 5 minutes


def _clean_old_attempts(key: str, now: float) -> None:
    cutoff = now - WINDOW_SECONDS
    _ATTEMPTS[key] = [t for t in _ATTEMPTS[key] if t > cutoff]


def is_rate_limited(ip: str, email: str) -> bool:
    """Check if the given IP or email is currently rate-limited."""
    now = time.time()
    with _LOCK:
        ip_key = f"ip:{ip}"
        email_key = f"email:{email.strip().lower()}"

        _clean_old_attempts(ip_key, now)
        _clean_old_attempts(email_key, now)

        if len(_ATTEMPTS[ip_key]) >= MAX_FAILED_ATTEMPTS:
            return True
        if len(_ATTEMPTS[email_key]) >= MAX_FAILED_ATTEMPTS:
            return True

        return False


def record_failed_attempt(ip: str, email: str) -> None:
    """Record a failed login attempt for both the IP and email."""
    now = time.time()
    with _LOCK:
        ip_key = f"ip:{ip}"
        email_key = f"email:{email.strip().lower()}"

        _ATTEMPTS[ip_key].append(now)
        _ATTEMPTS[email_key].append(now)


def record_successful_attempt(ip: str, email: str) -> None:
    """Clear failed attempts upon a successful login."""
    with _LOCK:
        ip_key = f"ip:{ip}"
        email_key = f"email:{email.strip().lower()}"
        _ATTEMPTS.pop(ip_key, None)
        _ATTEMPTS.pop(email_key, None)


def reset_rate_limits() -> None:
    """Reset all recorded rate limit state (useful in tests)."""
    with _LOCK:
        _ATTEMPTS.clear()
