from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from src.api.deps import require_role
from src.config.database import get_university_db
from src.models.schemas import AdminDashboardStats, UserCreate, UserResponse
from src.services.auth import hash_password

router = APIRouter(prefix="/api/admin", tags=["University Admin"])

_admin = require_role("admin")


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


@router.get("/dashboard", response_model=AdminDashboardStats)
async def dashboard(user: dict = Depends(_admin)):
    db = get_university_db(user["university_slug"])
    instructor_count = await db.users.count_documents({"role": "instructor"})
    student_count = await db.users.count_documents({"role": "student"})
    course_count = await db.courses.count_documents({})
    return AdminDashboardStats(
        instructor_count=instructor_count,
        student_count=student_count,
        course_count=course_count,
    )


# ── Instructors ──────────────────────────────────────────────────────────────


@router.get("/instructors", response_model=list[UserResponse])
async def list_instructors(user: dict = Depends(_admin)):
    db = get_university_db(user["university_slug"])
    docs = await db.users.find({"role": "instructor"}).sort("created_at", -1).to_list(length=None)
    return [_doc_to_user(d) for d in docs]


@router.post(
    "/instructors",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_instructor(body: UserCreate, user: dict = Depends(_admin)):
    db = get_university_db(user["university_slug"])

    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    doc = {
        "email": body.email,
        "password_hash": hash_password(body.password),
        "full_name": body.full_name,
        "role": "instructor",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_user(doc)


@router.delete("/instructors/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instructor(user_id: str, user: dict = Depends(_admin)):
    oid = _parse_object_id(user_id)
    db = get_university_db(user["university_slug"])
    result = await db.users.delete_one({"_id": oid, "role": "instructor"})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instructor not found",
        )


# ── Students ─────────────────────────────────────────────────────────────────


@router.get("/students", response_model=list[UserResponse])
async def list_students(user: dict = Depends(_admin)):
    db = get_university_db(user["university_slug"])
    docs = await db.users.find({"role": "student"}).sort("created_at", -1).to_list(length=None)
    return [_doc_to_user(d) for d in docs]


@router.post(
    "/students",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_student(body: UserCreate, user: dict = Depends(_admin)):
    db = get_university_db(user["university_slug"])

    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    doc = {
        "email": body.email,
        "password_hash": hash_password(body.password),
        "full_name": body.full_name,
        "role": "student",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_user(doc)


@router.delete("/students/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(user_id: str, user: dict = Depends(_admin)):
    oid = _parse_object_id(user_id)
    db = get_university_db(user["university_slug"])
    result = await db.users.delete_one({"_id": oid, "role": "student"})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )


# ── Courses (read-only) ─────────────────────────────────────────────────────


@router.get("/courses", response_model=list[dict])
async def list_courses(user: dict = Depends(_admin)):
    db = get_university_db(user["university_slug"])
    docs = await db.courses.find().sort("created_at", -1).to_list(length=None)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return docs
