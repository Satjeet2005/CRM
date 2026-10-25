from app.auth.password import hash_password, verify_password


def test_hash_password_creates_argon2_hash():
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)
    assert hashed.startswith("$argon2")
    assert hashed != password


def test_verify_password_matches_correct_password():
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)
    assert verify_password(password, hashed) is True


def test_verify_password_rejects_incorrect_password():
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)
    assert verify_password("WrongPassword!", hashed) is False
