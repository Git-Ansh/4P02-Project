from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from src.api.deps import require_role
from src.config.database import get_university_db
from src.models.schemas import (
    AdminDashboardStats,
    UserCreate,
    UserResponse,
)
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
    course_count = await db.courses.count_documents({})
    return AdminDashboardStats(
        instructor_count=instructor_count,
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


# ── Courses (read-only) ─────────────────────────────────────────────────────


@router.get("/courses")
async def list_courses(user: dict = Depends(_admin)):
    db = get_university_db(user["university_slug"])
    docs = await db.courses.find().sort("created_at", -1).to_list(length=None)
    result = []
    for d in docs:
        result.append({
            "id": str(d["_id"]),
            "code": d["code"],
            "title": d["title"],
            "term": d.get("term", ""),
            "instructor_name": d.get("instructor_name", ""),
            "instructor_email": d.get("instructor_email", ""),
        })
    return result


@router.get("/courses/{course_id}/details")
async def get_course_details(course_id: str, user: dict = Depends(_admin)):
    oid = _parse_object_id(course_id)
    db = get_university_db(user["university_slug"])

    assignment_docs = await db.assignments.find({"course_id": oid}).sort("created_at", -1).to_list(length=None)

    assignments = []
    for a in assignment_docs:
        a_oid = a["_id"]
        submission_count = await db.submissions.count_documents({"assignment_id": a_oid})
        assignments.append({
            "title": a["title"],
            "posted_at": a["created_at"].replace(tzinfo=timezone.utc).isoformat() if a.get("created_at") and a["created_at"].tzinfo is None else (a["created_at"].isoformat() if a.get("created_at") else None),
            "submission_count": submission_count,
        })

    submission_count = await db.submissions.count_documents({"course_id": oid})

    return {
        "assignment_count": len(assignments),
        "submission_count": submission_count,
        "assignments": assignments,
    }


# ── Identity Reveal Requests ────────────────────────────────────────────────


@router.get("/reveal-requests")
async def list_reveal_requests(user: dict = Depends(_admin)):
    db = get_university_db(user["university_slug"])
    docs = await db.reveal_requests.find({"status": "pending"}).sort("requested_at", -1).to_list(length=None)
    result = []
    for d in docs:
        result.append({
            "id": str(d["_id"]),
            "instructor_name": d.get("instructor_name", ""),
            "instructor_email": d.get("instructor_email", ""),
            "course_code": d.get("course_code", ""),
            "assignment_title": d.get("assignment_title", ""),
            "assignment_description": d.get("assignment_description", ""),
            "justification": d.get("justification", ""),
            "pair_id": d.get("pair_id", ""),
            "requested_at": d["requested_at"].isoformat() if d.get("requested_at") else None,
        })
    return result


@router.post("/reveal-requests/{request_id}/approve")
async def approve_reveal_request(request_id: str, user: dict = Depends(_admin)):
    oid = _parse_object_id(request_id)
    db = get_university_db(user["university_slug"])
    result = await db.reveal_requests.update_one(
        {"_id": oid, "status": "pending"},
        {"$set": {"status": "approved", "resolved_at": datetime.now(timezone.utc), "resolved_by": user["sub"]}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found or already resolved")
    return {"message": "Request approved"}


@router.post("/reveal-requests/{request_id}/decline")
async def decline_reveal_request(request_id: str, user: dict = Depends(_admin)):
    oid = _parse_object_id(request_id)
    db = get_university_db(user["university_slug"])
    result = await db.reveal_requests.update_one(
        {"_id": oid, "status": "pending"},
        {"$set": {"status": "denied", "resolved_at": datetime.now(timezone.utc), "resolved_by": user["sub"]}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found or already resolved")
    return {"message": "Request declined"}
