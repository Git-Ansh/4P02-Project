from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from src.api.deps import require_role
from src.config.database import get_main_db, get_university_db
from src.models.schemas import (
    DashboardStats,
    UniversityCreate,
    UniversityDetailResponse,
    UniversityResponse,
    UniversityUpdate,
    UserCreate,
    UserResponse,
)
from src.services.auth import hash_password

router = APIRouter(prefix="/api/super-admin", tags=["Super Admin"])

_super_admin = require_role("super_admin")


def _doc_to_university(
    doc: dict, admin_count: int | None = None
) -> UniversityResponse | UniversityDetailResponse:
    if admin_count is not None:
        return UniversityDetailResponse(
            id=str(doc["_id"]),
            name=doc["name"],
            slug=doc["slug"],
            domain=doc.get("domain"),
            logo_url=doc.get("logo_url"),
            primary_color=doc.get("primary_color"),
            secondary_color=doc.get("secondary_color"),
            status=doc["status"],
            created_at=doc["created_at"],
            admin_count=admin_count,
        )
    return UniversityResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        slug=doc["slug"],
        domain=doc.get("domain"),
        logo_url=doc.get("logo_url"),
        primary_color=doc.get("primary_color"),
        secondary_color=doc.get("secondary_color"),
        status=doc["status"],
        created_at=doc["created_at"],
    )


def _doc_to_user(doc: dict) -> UserResponse:
    return UserResponse(
        id=str(doc["_id"]),
        email=doc["email"],
        full_name=doc["full_name"],
        role=doc["role"],
        created_at=doc["created_at"],
    )


def _parse_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format",
        )


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard(_: dict = Depends(_super_admin)):
    db = get_main_db()
    uni_count = await db.universities.count_documents({"status": "active"})

    total_admins = 0
    async for uni in db.universities.find({"status": "active"}, {"slug": 1}):
        uni_db = get_university_db(uni["slug"])
        total_admins += await uni_db.users.count_documents({"role": "admin"})

    return DashboardStats(universities_count=uni_count, total_admins=total_admins)


@router.get("/universities", response_model=list[UniversityDetailResponse])
async def list_universities(_: dict = Depends(_super_admin)):
    db = get_main_db()
    docs = await db.universities.find().sort("created_at", -1).to_list(length=None)
    results = []
    for d in docs:
        uni_db = get_university_db(d["slug"])
        admin_count = await uni_db.users.count_documents({"role": "admin"})
        results.append(_doc_to_university(d, admin_count=admin_count))
    return results


@router.post(
    "/universities",
    response_model=UniversityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_university(
    body: UniversityCreate, _: dict = Depends(_super_admin)
):
    db = get_main_db()

    existing = await db.universities.find_one({"slug": body.slug})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A university with this slug already exists",
        )

    doc = {
        "name": body.name,
        "slug": body.slug,
        "domain": body.domain,
        "logo_url": body.logo_url,
        "primary_color": body.primary_color,
        "secondary_color": body.secondary_color,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.universities.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Ensure slug uniqueness index for race condition safety
    await db.universities.create_index("slug", unique=True)

    # Bootstrap the university database with a unique email index on users
    uni_db = get_university_db(body.slug)
    await uni_db.users.create_index("email", unique=True)

    return _doc_to_university(doc)


@router.delete("/universities/{university_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_university(
    university_id: str, _: dict = Depends(_super_admin)
):
    oid = _parse_object_id(university_id)
    db = get_main_db()
    result = await db.universities.update_one(
        {"_id": oid}, {"$set": {"status": "inactive"}}
    )
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="University not found",
        )


@router.patch(
    "/universities/{university_id}",
    response_model=UniversityResponse,
)
async def update_university(
    university_id: str, body: UniversityUpdate, _: dict = Depends(_super_admin)
):
    oid = _parse_object_id(university_id)
    db = get_main_db()

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    result = await db.universities.update_one({"_id": oid}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="University not found",
        )

    doc = await db.universities.find_one({"_id": oid})
    return _doc_to_university(doc)


@router.get(
    "/universities/{university_id}/admins",
    response_model=list[UserResponse],
)
async def list_admins(
    university_id: str, _: dict = Depends(_super_admin)
):
    oid = _parse_object_id(university_id)
    db = get_main_db()
    university = await db.universities.find_one({"_id": oid})
    if not university:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="University not found",
        )

    uni_db = get_university_db(university["slug"])
    admins = await uni_db.users.find({"role": "admin"}).to_list(length=None)
    return [_doc_to_user(a) for a in admins]


@router.post(
    "/universities/{university_id}/admins",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_admin(
    university_id: str, body: UserCreate, _: dict = Depends(_super_admin)
):
    if body.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only admin role can be created through this endpoint",
        )

    oid = _parse_object_id(university_id)
    db = get_main_db()
    university = await db.universities.find_one({"_id": oid})
    if not university:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="University not found",
        )

    uni_db = get_university_db(university["slug"])

    existing = await uni_db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    doc = {
        "email": body.email,
        "password_hash": hash_password(body.password),
        "full_name": body.full_name,
        "role": "admin",
        "created_at": datetime.now(timezone.utc),
    }
    result = await uni_db.users.insert_one(doc)
    doc["_id"] = result.inserted_id

    return _doc_to_user(doc)


@router.delete(
    "/universities/{university_id}/admins/{admin_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_admin(
    university_id: str, admin_id: str, _: dict = Depends(_super_admin)
):
    uni_oid = _parse_object_id(university_id)
    admin_oid = _parse_object_id(admin_id)

    db = get_main_db()
    university = await db.universities.find_one({"_id": uni_oid})
    if not university:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="University not found",
        )

    uni_db = get_university_db(university["slug"])
    result = await uni_db.users.delete_one({"_id": admin_oid, "role": "admin"})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found",
        )
