from pwdlib import PasswordHash

_pwd_context = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash a password using Argon2id."""
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against an Argon2id hash."""
    return _pwd_context.verify(plain_password, hashed_password)
