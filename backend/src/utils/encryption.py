"""
Symmetric encryption using Fernet (AES-128-CBC + HMAC-SHA256).

The encryption key is derived from the application's JWT_SECRET using
PBKDF2-HMAC-SHA256, so no extra secrets need to be managed.
"""

import base64
import hashlib
import hmac

from cryptography.fernet import Fernet

from src.config.settings import settings

_SALT = b"academic-fbi-file-encryption-v1"


def _derive_key() -> bytes:
    """Derive a 32-byte Fernet key from JWT_SECRET via PBKDF2."""
    raw = hashlib.pbkdf2_hmac(
        "sha256",
        settings.JWT_SECRET.encode(),
        _SALT,
        iterations=100_000,
    )
    return base64.urlsafe_b64encode(raw)


_fernet = Fernet(_derive_key())


def encrypt_bytes(data: bytes) -> bytes:
    """Encrypt raw bytes, return ciphertext."""
    return _fernet.encrypt(data)


def decrypt_bytes(data: bytes) -> bytes:
    """Decrypt ciphertext, return raw bytes."""
    return _fernet.decrypt(data)


def encrypt_string(text: str) -> str:
    """Encrypt a string, return URL-safe base64 ciphertext."""
    return _fernet.encrypt(text.encode("utf-8")).decode("ascii")


def decrypt_string(token: str) -> str:
    """Decrypt a URL-safe base64 ciphertext back to a string."""
    return _fernet.decrypt(token.encode("ascii")).decode("utf-8")


def make_submission_id(student_name: str, student_number: str, student_email: str) -> str:
    """Create a deterministic encrypted submission ID from student identity.

    Uses HMAC-SHA256 to produce a short, stable, URL-safe identifier.
    The same student always gets the same ID for a given server secret.
    """
    payload = f"{student_number}:{student_name}:{student_email}"
    digest = hmac.new(
        settings.JWT_SECRET.encode(),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16]
    return digest
