"""
FastAPI dependency factories for authentication and role-based access control.

Usage in route handlers
-----------------------
    # Require any authenticated user:
    user: dict = Depends(get_current_user)

    # Require a specific role (or one of several):
    user: dict = Depends(require_role("instructor"))
    user: dict = Depends(require_role("university_admin", "super_admin"))

The ``user`` dict is the decoded JWT payload and contains at minimum:
    sub   — user document _id (string)
    role  — one of: "student", "instructor", "university_admin", "super_admin"
    slug  — university slug (absent for super_admin)
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from src.services.auth import decode_access_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Extract and validate the Bearer JWT from the Authorization header.

    Returns the decoded token payload on success.
    Raises HTTP 401 if the token is missing, malformed, or expired.
    """
    try:
        payload = decode_access_token(credentials.credentials)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload


def require_role(*allowed_roles: str):
    """Return a FastAPI dependency that enforces role-based access control.

    Args:
        *allowed_roles: One or more role strings that are permitted to access
                        the endpoint (e.g. ``"instructor"``, ``"super_admin"``).

    Returns:
        An async dependency function that resolves to the current user dict,
        or raises HTTP 403 if the user's role is not in *allowed_roles*.
    """
    async def _check(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _check
