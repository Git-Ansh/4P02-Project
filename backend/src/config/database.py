"""
MongoDB connection management using Motor (async driver).

Database layout
---------------
The platform uses two tiers of MongoDB databases:

  academic_fbi          — global database (users, universities, super-admin data)
  uni_{slug}            — per-university database (courses, assignments,
                          submissions, analysis results)

A single AsyncIOMotorClient is shared across the process lifetime and stored
in the module-level ``_client`` singleton.  Call ``connect_db()`` once at
startup (via the FastAPI lifespan hook) and ``close_db()`` on shutdown.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.server_api import ServerApi

from src.config.settings import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    """Return the shared Motor client, raising RuntimeError if not yet initialised."""
    if _client is None:
        raise RuntimeError("Database client not initialized. Call connect_db() first.")
    return _client


def get_main_db():
    """Return the global 'academic_fbi' database handle."""
    return get_client()[settings.DB_NAME]


def get_university_db(slug: str):
    """Return the per-university database handle for the given institution slug.

    Each university gets its own MongoDB database named ``uni_{slug}``, keeping
    course, assignment, submission, and analysis data fully isolated per institution.
    """
    return get_client()[f"uni_{slug}"]


async def connect_db() -> None:
    """Create the Motor client and verify connectivity with a ping command.

    Called once during FastAPI startup via the lifespan context manager.
    Raises on connection failure so the server does not start silently broken.
    """
    global _client
    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        server_api=ServerApi("1"),
    )
    await _client.admin.command("ping")


async def close_db() -> None:
    """Close the Motor client and release the connection pool.

    Called during FastAPI shutdown via the lifespan context manager.
    Safe to call even if the client was never successfully initialised.
    """
    global _client
    if _client is not None:
        _client.close()
        _client = None
