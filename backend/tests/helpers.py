"""Shared constants and helpers for the test suite."""

TEST_UNI_SLUG = "test-uni"
TEST_PASSWORD = "password123"


def auth_header(token: str) -> dict:
    """Build an Authorization header from a JWT token."""
    return {"Authorization": f"Bearer {token}"}
