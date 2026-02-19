from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from src.api.deps import require_role
from src.config.database import get_university_db
from src.models.schemas import (
    AssignmentCreate,
    AssignmentResponse,
    AssignmentUpdate,
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    InstructorDashboardStats,
)

router = APIRouter(prefix="/api/instructor", tags=["Instructor"])

_instructor = require_role("instructor")


def _parse_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format",
        )


async def _doc_to_course(doc: dict, db) -> CourseResponse:
    student_count = await db.enrollments.count_documents({"course_id": doc["_id"]})
    return CourseResponse(
        id=str(doc["_id"]),
        code=doc["code"],
        title=doc["title"],
        term=doc["term"],
        description=doc.get("description"),
        instructor_email=doc["instructor_email"],
        instructor_name=doc["instructor_name"],
        student_count=student_count,
        created_at=doc["created_at"],
    )


def _doc_to_assignment(doc: dict) -> AssignmentResponse:
    return AssignmentResponse(
        id=str(doc["_id"]),
        course_id=str(doc["course_id"]),
        title=doc["title"],
        description=doc.get("description"),
        due_date=doc.get("due_date"),
        max_score=doc.get("max_score", 100),
        created_at=doc["created_at"],
    )


# ── Dashboard ───────────────────────────────────────────────────────────────


@router.get("/dashboard", response_model=InstructorDashboardStats)
async def dashboard(user: dict = Depends(_instructor)):
    db = get_university_db(user["university_slug"])
    course_count = await db.courses.count_documents(
        {"instructor_email": user["sub"]}
    )
    # Count unique students enrolled in this instructor's courses
    instructor_courses = await db.courses.find(
        {"instructor_email": user["sub"]}, {"_id": 1}
    ).to_list(length=None)
    course_ids = [c["_id"] for c in instructor_courses]
    if course_ids:
        pipeline = [
            {"$match": {"course_id": {"$in": course_ids}}},
            {"$group": {"_id": "$student_email"}},
            {"$count": "total"},
        ]
        result = await db.enrollments.aggregate(pipeline).to_list(length=1)
        total_students = result[0]["total"] if result else 0
    else:
        total_students = 0

    return InstructorDashboardStats(
        course_count=course_count,
        total_students=total_students,
    )


# ── Courses ─────────────────────────────────────────────────────────────────


@router.get("/courses", response_model=list[CourseResponse])
async def list_courses(user: dict = Depends(_instructor)):
    db = get_university_db(user["university_slug"])
    docs = (
        await db.courses.find({"instructor_email": user["sub"]})
        .sort("created_at", -1)
        .to_list(length=None)
    )
    return [await _doc_to_course(d, db) for d in docs]


@router.post(
    "/courses",
    response_model=CourseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_course(body: CourseCreate, user: dict = Depends(_instructor)):
    db = get_university_db(user["university_slug"])

    # Ensure unique index on code+term (idempotent)
    await db.courses.create_index(
        [("code", 1), ("term", 1)], unique=True
    )

    # Check for duplicate across all instructors in the university
    existing = await db.courses.find_one({"code": body.code, "term": body.term})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Course {body.code} already exists for {body.term}",
        )

    # Look up instructor's full name
    instructor = await db.users.find_one({"email": user["sub"]})
    instructor_name = instructor["full_name"] if instructor else user["sub"]

    doc = {
        "code": body.code,
        "title": body.title,
        "term": body.term,
        "description": body.description,
        "instructor_email": user["sub"],
        "instructor_name": instructor_name,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.courses.insert_one(doc)
    doc["_id"] = result.inserted_id
    return await _doc_to_course(doc, db)


@router.get("/courses/{course_id}", response_model=CourseResponse)
async def get_course(course_id: str, user: dict = Depends(_instructor)):
    oid = _parse_object_id(course_id)
    db = get_university_db(user["university_slug"])
    course = await db.courses.find_one(
        {"_id": oid, "instructor_email": user["sub"]}
    )
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )
    return await _doc_to_course(course, db)


@router.patch("/courses/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: str, body: CourseUpdate, user: dict = Depends(_instructor)
):
    oid = _parse_object_id(course_id)
    db = get_university_db(user["university_slug"])

    course = await db.courses.find_one(
        {"_id": oid, "instructor_email": user["sub"]}
    )
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    # If code or term is changing, check for duplicates
    new_code = updates.get("code", course["code"])
    new_term = updates.get("term", course["term"])
    if new_code != course["code"] or new_term != course["term"]:
        dup = await db.courses.find_one(
            {"code": new_code, "term": new_term, "_id": {"$ne": oid}}
        )
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Course {new_code} already exists for {new_term}",
            )

    await db.courses.update_one({"_id": oid}, {"$set": updates})
    doc = await db.courses.find_one({"_id": oid})
    return await _doc_to_course(doc, db)


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(course_id: str, user: dict = Depends(_instructor)):
    oid = _parse_object_id(course_id)
    db = get_university_db(user["university_slug"])

    result = await db.courses.delete_one(
        {"_id": oid, "instructor_email": user["sub"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )
    # Clean up enrollments and assignments for this course
    await db.enrollments.delete_many({"course_id": oid})
    await db.assignments.delete_many({"course_id": oid})


# ── Assignments ─────────────────────────────────────────────────────────────


async def _get_instructor_course(course_id: str, user: dict):
    """Helper: fetch a course owned by the current instructor, or 404."""
    oid = _parse_object_id(course_id)
    db = get_university_db(user["university_slug"])
    course = await db.courses.find_one(
        {"_id": oid, "instructor_email": user["sub"]}
    )
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )
    return oid, db


@router.get(
    "/courses/{course_id}/assignments",
    response_model=list[AssignmentResponse],
)
async def list_assignments(course_id: str, user: dict = Depends(_instructor)):
    oid, db = await _get_instructor_course(course_id, user)
    docs = (
        await db.assignments.find({"course_id": oid})
        .sort("created_at", -1)
        .to_list(length=None)
    )
    return [_doc_to_assignment(d) for d in docs]


@router.post(
    "/courses/{course_id}/assignments",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_assignment(
    course_id: str, body: AssignmentCreate, user: dict = Depends(_instructor)
):
    oid, db = await _get_instructor_course(course_id, user)

    doc = {
        "course_id": oid,
        "title": body.title,
        "description": body.description,
        "due_date": body.due_date,
        "max_score": body.max_score,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.assignments.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_assignment(doc)


@router.patch(
    "/courses/{course_id}/assignments/{assignment_id}",
    response_model=AssignmentResponse,
)
async def update_assignment(
    course_id: str,
    assignment_id: str,
    body: AssignmentUpdate,
    user: dict = Depends(_instructor),
):
    _, db = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    result = await db.assignments.update_one({"_id": a_oid}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )
    doc = await db.assignments.find_one({"_id": a_oid})
    return _doc_to_assignment(doc)


@router.delete(
    "/courses/{course_id}/assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_assignment(
    course_id: str,
    assignment_id: str,
    user: dict = Depends(_instructor),
):
    _, db = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    result = await db.assignments.delete_one({"_id": a_oid})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )
