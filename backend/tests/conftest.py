"""Shared fixtures for the Academic FBI backend test suite."""

import os
import shutil
import tempfile

# ── Environment (MUST be set before any src.* imports) ────────────────────
# Use test-specific DB names so we never touch production data.
# MONGODB_URI is intentionally NOT overridden — it comes from .env / environment
# so tests can connect to the real Atlas cluster (or a local instance in CI).
os.environ["DB_NAME"] = "test_academic_fbi"
os.environ["JWT_SECRET"] = "test-secret-key-for-testing"
os.environ.setdefault(
    "UPLOAD_DIR",
    os.path.join(tempfile.gettempdir(), "test_afbi_uploads"),
)

from datetime import datetime, timezone  # noqa: E402

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

import src.config.database as db_module  # noqa: E402
from src.config.settings import settings  # noqa: E402
from src.services.auth import create_access_token, hash_password  # noqa: E402

from tests.helpers import TEST_PASSWORD, TEST_UNI_SLUG  # noqa: E402


# ── MongoDB connection ────────────────────────────────────────────────────


@pytest.fixture(scope="session")
async def mongo_client():
    """Session-scoped Motor client using the real MONGODB_URI."""
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    await client.admin.command("ping")
    db_module._client = client
    yield client
    await client.drop_database(settings.DB_NAME)
    await client.drop_database(f"uni_{TEST_UNI_SLUG}")
    client.close()


@pytest.fixture(autouse=True)
async def _clean_db(mongo_client):
    """Wipe all collections after each test for isolation."""
    yield
    for db_name in [settings.DB_NAME, f"uni_{TEST_UNI_SLUG}"]:
        db = mongo_client[db_name]
        for coll in await db.list_collection_names():
            await db[coll].delete_many({})


# ── Upload directory ──────────────────────────────────────────────────────


@pytest.fixture(autouse=True, scope="session")
def _upload_dir():
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield
    shutil.rmtree(settings.UPLOAD_DIR, ignore_errors=True)


# ── HTTP client ───────────────────────────────────────────────────────────


@pytest.fixture
async def client(mongo_client):
    """Async HTTP client bound to the FastAPI app."""
    from src.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── JWT tokens ────────────────────────────────────────────────────────────


@pytest.fixture
def super_admin_token():
    return create_access_token(
        {"sub": "super@test.com", "role": "super_admin", "university_slug": None}
    )


@pytest.fixture
def instructor_token():
    return create_access_token(
        {
            "sub": "instructor@test.com",
            "role": "instructor",
            "university_slug": TEST_UNI_SLUG,
        }
    )


@pytest.fixture
def admin_token():
    return create_access_token(
        {"sub": "admin@test.com", "role": "admin", "university_slug": TEST_UNI_SLUG}
    )


# ── Seed data ─────────────────────────────────────────────────────────────


@pytest.fixture
async def seed_university(mongo_client):
    db = mongo_client[settings.DB_NAME]
    doc = {
        "name": "Test University",
        "slug": TEST_UNI_SLUG,
        "domain": "test.edu",
        "logo_url": None,
        "primary_color": "#2563eb",
        "secondary_color": "#1e40af",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.universities.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


@pytest.fixture
async def seed_super_admin(mongo_client):
    db = mongo_client[settings.DB_NAME]
    doc = {
        "email": "super@test.com",
        "password_hash": hash_password(TEST_PASSWORD),
        "full_name": "Super Admin",
        "role": "super_admin",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.super_admins.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


@pytest.fixture
async def seed_instructor(mongo_client, seed_university):
    db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
    doc = {
        "email": "instructor@test.com",
        "password_hash": hash_password(TEST_PASSWORD),
        "full_name": "Test Instructor",
        "role": "instructor",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


@pytest.fixture
async def seed_admin_user(mongo_client, seed_university):
    db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
    doc = {
        "email": "admin@test.com",
        "password_hash": hash_password(TEST_PASSWORD),
        "full_name": "Test Admin",
        "role": "admin",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


@pytest.fixture
async def sample_course(mongo_client, seed_instructor):
    db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
    doc = {
        "code": "CS101",
        "title": "Intro to CS",
        "term": "Winter 2026",
        "description": "Test course",
        "instructor_email": "instructor@test.com",
        "instructor_name": "Test Instructor",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.courses.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


@pytest.fixture
async def sample_assignment(mongo_client, sample_course):
    db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
    doc = {
        "course_id": sample_course["_id"],
        "title": "Assignment 1",
        "description": "First assignment",
        "due_date": None,
        "max_score": 100,
        "allow_resubmission": False,
        "language": "java",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.assignments.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


@pytest.fixture
async def sample_student(mongo_client, sample_course):
    db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
    doc = {
        "full_name": "Jane Student",
        "email": "jane@test.edu",
        "student_number": "STU001",
        "course_ids": [sample_course["_id"]],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.student_records.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc
