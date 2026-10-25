from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.auth.session import (
    create_session,
    generate_session_token,
    hash_session_token,
    revoke_all_user_sessions,
    revoke_session,
    validate_session,
)
from app.models.organization import Organization
from app.models.user import User


def test_session_token_and_hash():
    token = generate_session_token()
    assert len(token) >= 32
    token_hash = hash_session_token(token)
    assert len(token_hash) == 64
    assert hash_session_token(token) == token_hash


def test_create_and_validate_session(db_session: Session):
    user = db_session.query(User).first()
    org = db_session.query(Organization).first()
    assert user is not None and org is not None

    token, session_record = create_session(db_session, user.id, org.id)
    assert session_record.token_hash == hash_session_token(token)

    # Validate active session
    validated = validate_session(db_session, token)
    assert validated is not None
    assert validated.id == session_record.id


def test_revoked_session_fails_validation(db_session: Session):
    user = db_session.query(User).first()
    org = db_session.query(Organization).first()

    token, session_record = create_session(db_session, user.id, org.id)
    revoke_session(db_session, session_record)

    validated = validate_session(db_session, token)
    assert validated is None


def test_revoke_all_user_sessions(db_session: Session):
    user = db_session.query(User).first()
    org = db_session.query(Organization).first()

    token1, _ = create_session(db_session, user.id, org.id)
    token2, _ = create_session(db_session, user.id, org.id)

    revoke_all_user_sessions(db_session, user.id)

    assert validate_session(db_session, token1) is None
    assert validate_session(db_session, token2) is None


def test_idle_timeout_expires_session(db_session: Session):
    user = db_session.query(User).first()
    org = db_session.query(Organization).first()

    token, session_record = create_session(db_session, user.id, org.id)

    # Artificially age last_seen_at past 61 minutes
    session_record.last_seen_at = datetime.now(timezone.utc) - timedelta(minutes=65)
    db_session.commit()

    validated = validate_session(db_session, token)
    assert validated is None


def test_absolute_lifetime_expires_session(db_session: Session):
    user = db_session.query(User).first()
    org = db_session.query(Organization).first()

    token, session_record = create_session(db_session, user.id, org.id)

    # Artificially age expires_at into the past
    session_record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    db_session.commit()

    validated = validate_session(db_session, token)
    assert validated is None
