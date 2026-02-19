from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.auth import router as auth_router
from src.api.instructor import router as instructor_router
from src.api.super_admin import router as super_admin_router
from src.api.university_admin import router as admin_router
from src.config.database import connect_db, close_db, get_client, get_main_db
from src.models.schemas import UniversityResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(title="Academic FBI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://4-p02-project.vercel.app",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(super_admin_router)
app.include_router(admin_router)
app.include_router(instructor_router)


@app.get("/health")
async def health_check():
    await get_client().admin.command("ping")
    return {"status": "ok", "database": "connected"}


@app.get("/api/universities", response_model=list[UniversityResponse])
async def list_active_universities():
    """Public endpoint to list all active universities."""
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
