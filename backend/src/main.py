"""
Academic FBI — FastAPI application entry point.

Responsibilities:
- Initialises the MongoDB connection on startup and closes it on shutdown.
- Registers all API routers under their respective URL prefixes.
- Configures CORS to allow the Vercel-hosted frontend and local dev origins.
- Exposes two shared endpoints that require no authentication:
    GET /health              — liveness / database ping
    GET /api/universities   — list of active universities (used by the student
                              submission portal's institution picker)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.auth import router as auth_router
from src.api.instructor import router as instructor_router
from src.api.submission import router as submission_router
from src.api.super_admin import router as super_admin_router
from src.api.university_admin import router as admin_router
from src.config.database import connect_db, close_db, get_client, get_main_db
from src.models.schemas import UniversityResponse
from src.services.course_expiry import start_expiry_cleanup_task


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context: open the DB connection before serving, close it on shutdown.

    Also starts the daily course-expiry cleanup background task which deletes
    submission data for courses whose 30-day grace period has ended.
    """
    await connect_db()
    cleanup_task = start_expiry_cleanup_task()
    yield
    cleanup_task.cancel()
    await close_db()


app = FastAPI(title="Academic FBI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://4-p02-project.*\.vercel\.app|http://localhost:3000",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(super_admin_router)
app.include_router(admin_router)
app.include_router(instructor_router)
app.include_router(submission_router)


@app.get("/health")
async def health_check():
    """Liveness probe. Pings MongoDB and returns 200 if both the API and database are reachable."""
    await get_client().admin.command("ping")
    return {"status": "ok", "database": "connected"}


@app.get("/api/universities", response_model=list[UniversityResponse])
async def list_active_universities():
    """Return all universities whose status is 'active', sorted alphabetically.

    Used by the public student submission portal to populate the institution
    picker before a student enters their assignment key.
    """
    db = get_main_db()
    docs = await db.universities.find(
        {"status": "active"}
    ).sort("name", 1).to_list(length=None)

    return [
        UniversityResponse(
            id=str(doc["_id"]),
            name=doc["name"],
            slug=doc["slug"],
            domain=doc.get("domain"),
            logo_url=doc.get("logo_url"),
            status=doc["status"],
            created_at=doc["created_at"],
        )
        for doc in docs
    ]
# Force reload
