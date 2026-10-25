import json
import logging
import re
import uuid
from typing import Any

from fastapi import Request

logger = logging.getLogger("forgeflow.telemetry")

REQUEST_ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-]{8,64}$")

SENSITIVE_FIELD_PATTERNS = [
    re.compile(r"password", re.IGNORECASE),
    re.compile(r"token", re.IGNORECASE),
    re.compile(r"secret", re.IGNORECASE),
    re.compile(r"cookie", re.IGNORECASE),
    re.compile(r"authorization", re.IGNORECASE),
    re.compile(r"csrf", re.IGNORECASE),
    re.compile(r"unit_cost", re.IGNORECASE),
    re.compile(r"line_cost", re.IGNORECASE),
    re.compile(r"margin", re.IGNORECASE),
]


def sanitize_or_generate_request_id(incoming: str | None) -> str:
    """
    Validates that incoming correlation ID matches a strict safe character allowlist
    and bounded length (8 to 64 chars, alphanumeric, hyphen, underscore).
    Replaces invalid, malicious, or control-character containing IDs with a new UUIDv4.
    """
    if incoming and REQUEST_ID_REGEX.match(incoming):
        # Strip potential whitespace
        return incoming.strip()
    return str(uuid.uuid4())


def redact_sensitive_data(data: Any) -> Any:
    """
    Recursively redacts sensitive keys such as passwords, tokens, costs, and cookies.
    """
    if isinstance(data, dict):
        redacted = {}
        for k, v in data.items():
            if any(p.search(str(k)) for p in SENSITIVE_FIELD_PATTERNS):
                redacted[k] = "[REDACTED]"
            else:
                redacted[k] = redact_sensitive_data(v)
        return redacted
    if isinstance(data, list):
        return [redact_sensitive_data(item) for item in data]
    return data


class StructuredLogFormatter(logging.Formatter):
    """
    Emits single-record structured JSON logs suitable for production ingestion.
    Guarantees no multi-line newline injection from user-controlled parameters.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Include request ID if present
        request_id = getattr(record, "request_id", None)
        if request_id:
            log_entry["request_id"] = str(request_id)

        # Include HTTP access attributes if attached
        for attr in ("method", "path", "status_code", "duration_ms", "client_ip"):
            val = getattr(record, attr, None)
            if val is not None:
                log_entry[attr] = val

        if record.exc_info and not record.exc_text:
            record.exc_text = self.formatException(record.exc_info)
        if record.exc_text:
            log_entry["exception"] = record.exc_text.replace("\n", " -- ")

        return json.dumps(log_entry)


def log_http_request(
    request: Request,
    status_code: int,
    duration_ms: float,
    request_id: str,
) -> None:
    """
    Logs an HTTP access event with structured parameters and safe redactions.
    Does not log authorization headers, cookie values, request/response bodies,
    or internal costs.
    """
    client_ip = request.client.host if request.client else "unknown"
    # Mask path query parameters that may contain sensitive data
    path = request.url.path

    level = logging.INFO
    if status_code >= 500:
        level = logging.ERROR
    elif status_code >= 400:
        level = logging.WARNING

    extra = {
        "request_id": request_id,
        "method": request.method,
        "path": path,
        "status_code": status_code,
        "duration_ms": duration_ms,
        "client_ip": client_ip,
    }

    logger.log(
        level,
        f"{request.method} {path} HTTP {status_code} ({duration_ms}ms)",
        extra=extra,
    )
