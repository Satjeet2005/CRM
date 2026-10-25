import json
import logging
import uuid

from app.telemetry import (
    StructuredLogFormatter,
    redact_sensitive_data,
    sanitize_or_generate_request_id,
)


def test_sanitize_request_id_valid() -> None:
    valid_id = "req-12345-abcde-67890"
    result = sanitize_or_generate_request_id(valid_id)
    assert result == valid_id


def test_sanitize_request_id_invalid_characters() -> None:
    # Malicious incoming request ID with newlines / control characters
    malicious_id = "req-123\nInject: Header\r\n"
    result = sanitize_or_generate_request_id(malicious_id)
    assert result != malicious_id
    # Must be replaced with valid UUID
    uuid.UUID(result)


def test_sanitize_request_id_too_short_or_too_long() -> None:
    short_id = "abc"
    result_short = sanitize_or_generate_request_id(short_id)
    assert result_short != short_id
    uuid.UUID(result_short)

    long_id = "a" * 100
    result_long = sanitize_or_generate_request_id(long_id)
    assert result_long != long_id
    uuid.UUID(result_long)


def test_sanitize_request_id_none_or_empty() -> None:
    assert uuid.UUID(sanitize_or_generate_request_id(None))
    assert uuid.UUID(sanitize_or_generate_request_id(""))


def test_redact_sensitive_data() -> None:
    payload = {
        "user_email": "sales@forgeflow.demo",
        "password": "SuperSecretPassword123!",
        "session_token": "a1b2c3d4e5f6g7h8",
        "csrf_token": "xyz987654321",
        "nested": {
            "unit_cost": "2000.00",
            "line_cost": "200000.00",
            "margin_percent": "22.50",
            "quantity": 100,
        },
        "items": [
            {"product": "VALV-BALL-BR-50", "unit_price": "2800.00"},
            {"cookie_secret": "sensitive-cookie"},
        ],
    }

    redacted = redact_sensitive_data(payload)

    assert redacted["user_email"] == "sales@forgeflow.demo"
    assert redacted["password"] == "[REDACTED]"
    assert redacted["session_token"] == "[REDACTED]"
    assert redacted["csrf_token"] == "[REDACTED]"
    assert redacted["nested"]["unit_cost"] == "[REDACTED]"
    assert redacted["nested"]["line_cost"] == "[REDACTED]"
    assert redacted["nested"]["margin_percent"] == "[REDACTED]"
    assert redacted["nested"]["quantity"] == 100
    assert redacted["items"][0]["unit_price"] == "2800.00"
    assert redacted["items"][1]["cookie_secret"] == "[REDACTED]"


def test_structured_log_formatter_emits_valid_single_line_json() -> None:
    formatter = StructuredLogFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="Processed quote recalculation successfully",
        args=(),
        exc_info=None,
    )
    record.request_id = "req-test-uuid-12345"
    record.method = "POST"
    record.path = "/api/v1/quotes"
    record.status_code = 200
    record.duration_ms = 42.50

    output = formatter.format(record)
    # Must not contain raw newlines (single line JSON record)
    assert "\n" not in output

    parsed = json.loads(output)
    assert parsed["level"] == "INFO"
    assert parsed["request_id"] == "req-test-uuid-12345"
    assert parsed["method"] == "POST"
    assert parsed["path"] == "/api/v1/quotes"
    assert parsed["status_code"] == 200
    assert parsed["duration_ms"] == 42.50
    assert parsed["message"] == "Processed quote recalculation successfully"
