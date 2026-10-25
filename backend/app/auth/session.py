import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models.session import SessionModel


def generate_session_token() -> str:
    """Generate a cryptographically secure opaque session token."""
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    """Compute the SHA-256 hash of a session token for storage and lookup."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(
    db: Session,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[str, SessionModel]:
    """Create and persist a new session, returning the raw token and model."""
    raw_token = generate_session_token()
    token_hash = hash_session_token(raw_token)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=settings.SESSION_TTL_HOURS)

    session_record = SessionModel(
        user_id=user_id,
        organization_id=organization_id,
        token_hash=token_hash,
        created_at=now,
        last_seen_at=now,
        expires_at=expires_at,
        revoked_at=None,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(session_record)
    db.commit()
    db.refresh(session_record)
    return raw_token, session_record


def validate_session(db: Session, raw_token: str) -> SessionModel | None:
    """
    Validate a raw session token against the database.
    Checks existence, revocation, absolute expiration, and idle timeout.
    Updates last_seen_at upon successful validation.
    """
    if not raw_token:
        return None

    token_hash = hash_session_token(raw_token)
    stmt = select(SessionModel).where(SessionModel.token_hash == token_hash)
    session_record = db.execute(stmt).scalar_one_or_none()

    if not session_record:
        return None

    if session_record.revoked_at is not None:
        return None

    now = datetime.now(timezone.utc)

    # Check absolute lifetime
    if now > session_record.expires_at:
        return None

    # Check idle timeout (last_seen_at + SESSION_IDLE_TTL_MINUTES)
    idle_limit = timedelta(minutes=settings.SESSION_IDLE_TTL_MINUTES)
    if (now - session_record.last_seen_at) > idle_limit:
        return None

    # Update last seen timestamp
    session_record.last_seen_at = now
    db.commit()
    return session_record


def revoke_session(db: Session, session_record: SessionModel) -> None:
    """Revoke a single session."""
    session_record.revoked_at = datetime.now(timezone.utc)
    db.commit()


def revoke_all_user_sessions(db: Session, user_id: uuid.UUID) -> None:
    """Revoke all active sessions for a user (e.g. on deactivation or password change)."""
    now = datetime.now(timezone.utc)
    stmt = (
        update(SessionModel)
        .where(SessionModel.user_id == user_id, SessionModel.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.execute(stmt)
    db.commit()
