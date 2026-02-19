from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.server_api import ServerApi

from src.config.settings import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("Database client not initialized. Call connect_db() first.")
    return _client


def get_main_db():
    return get_client()[settings.DB_NAME]


def get_university_db(slug: str):
    return get_client()[f"uni_{slug}"]


async def connect_db() -> None:
    global _client
    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        server_api=ServerApi("1"),
    )
    await _client.admin.command("ping")


async def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
