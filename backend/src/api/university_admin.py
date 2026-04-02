from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from src.api.deps import require_role
from src.config.database import get_university_db
from src.models.schemas import (
    AdminDashboardStats,
    StudentRecordCreate,
    StudentRecordResponse,
    StudentRecordUpdate,
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
    student_record_count = await db.student_records.count_documents({})
    return AdminDashboardStats(
        instructor_count=instructor_count,
        course_count=course_count,
        student_record_count=student_record_count,
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


# ── Student Records ─────────────────────────────────────────────────────────


async def _build_student_response(doc: dict, db) -> StudentRecordResponse:
    """Build a StudentRecordResponse with enriched course details."""
    course_ids = doc.get("course_ids", [])
    courses = []
    if course_ids:
        cursor = db.courses.find({"_id": {"$in": course_ids}})
        async for c in cursor:
            courses.append({
                "id": str(c["_id"]),
                "code": c["code"],
                "title": c["title"],
            })
    return StudentRecordResponse(
        id=str(doc["_id"]),
        full_name=doc["full_name"],
        email=doc["email"],
        student_number=doc["student_number"],
        courses=courses,
        created_at=doc["created_at"],
    )


@router.get("/students", response_model=list[StudentRecordResponse])
async def list_students(user: dict = Depends(_admin)):
    db = get_university_db(user["university_slug"])
    docs = await db.student_records.find().sort("created_at", -1).to_list(length=None)
    return [await _build_student_response(d, db) for d in docs]


@router.post(
    "/students",
    response_model=StudentRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_student(body: StudentRecordCreate, user: dict = Depends(_admin)):
    db = get_university_db(user["university_slug"])

    # Ensure unique indexes
    await db.student_records.create_index("student_number", unique=True)
    await db.student_records.create_index("email", unique=True)

    # Check for duplicates
    existing = await db.student_records.find_one({
        "$or": [
            {"email": body.email},
            {"student_number": body.student_number},
        ]
    })
    if existing:
        if existing["email"] == body.email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A student with this email already exists",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A student with this student number already exists",
        )

    course_oids = [_parse_object_id(cid) for cid in body.course_ids]

    doc = {
        "full_name": body.full_name,
        "email": body.email,
        "student_number": body.student_number,
        "course_ids": course_oids,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.student_records.insert_one(doc)
    doc["_id"] = result.inserted_id
    return await _build_student_response(doc, db)


@router.patch("/students/{student_id}", response_model=StudentRecordResponse)
async def update_student(
    student_id: str, body: StudentRecordUpdate, user: dict = Depends(_admin)
):
    oid = _parse_object_id(student_id)
    db = get_university_db(user["university_slug"])

    existing = await db.student_records.find_one({"_id": oid})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found",
        )

    updates: dict = {}
    if body.full_name is not None:
        updates["full_name"] = body.full_name
    if body.email is not None:
        dup = await db.student_records.find_one(
            {"email": body.email, "_id": {"$ne": oid}}
        )
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A student with this email already exists",
            )
        updates["email"] = body.email
    if body.student_number is not None:
        dup = await db.student_records.find_one(
            {"student_number": body.student_number, "_id": {"$ne": oid}}
        )
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A student with this student number already exists",
            )
        updates["student_number"] = body.student_number
    if body.course_ids is not None:
        updates["course_ids"] = [_parse_object_id(cid) for cid in body.course_ids]

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    await db.student_records.update_one({"_id": oid}, {"$set": updates})
    doc = await db.student_records.find_one({"_id": oid})
    return await _build_student_response(doc, db)


@router.delete("/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(student_id: str, user: dict = Depends(_admin)):
    oid = _parse_object_id(student_id)
    db = get_university_db(user["university_slug"])
    result = await db.student_records.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found",
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

    student_count = await db.student_records.count_documents({"course_ids": oid})

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
        "student_count": student_count,
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
