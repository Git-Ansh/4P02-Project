"""
Authentication helpers: password hashing and JWT token management.

Password hashing
----------------
Passwords are hashed with bcrypt via passlib.  The work factor is managed
automatically by passlib and is high enough to resist offline brute-force
attacks.  Plain-text passwords are never stored or logged.

JWT tokens
----------
Access tokens are signed HS256 JWTs containing the user's id, role, and
university slug in their payload.  The expiry defaults to 24 hours
(JWT_EXPIRY_MINUTES setting).  There are no refresh tokens — clients must
re-authenticate after expiry.
"""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from src.config.settings import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Return a bcrypt hash of *password*."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches the bcrypt *hashed* value."""
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    """Encode *data* as a signed JWT with an expiry timestamp.

    Args:
        data: Arbitrary claims to embed (e.g. ``{"sub": user_id, "role": "instructor"}``).

    Returns:
        A compact JWT string ready to be sent in the Authorization header.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_EXPIRY_MINUTES
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT string, returning the claims payload.

    Raises:
        jose.JWTError: If the token is invalid, tampered with, or expired.
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
