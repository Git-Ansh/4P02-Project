import threading
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt

from src.api.deps import require_role
from src.config.database import get_university_db, get_main_db
from src.config.settings import settings
from src.models.schemas import (
    AnonymousSubmissionResponse,
    AssignmentCreate,
    AssignmentResponse,
    AssignmentUpdate,
    CourseCreate,
    CourseResponse,
    CourseStudentResponse,
    CourseUpdate,
    EnrollStudentsRequest,
    InstructorDashboardStats,
    SendTokenEmailRequest,
    SubmissionTokenResponse,
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


def _doc_to_course(doc: dict) -> CourseResponse:
    return CourseResponse(
        id=str(doc["_id"]),
        code=doc["code"],
        title=doc["title"],
        term=doc["term"],
        description=doc.get("description"),
        instructor_email=doc["instructor_email"],
        instructor_name=doc["instructor_name"],
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
        allow_resubmission=doc.get("allow_resubmission", False),
        language=doc.get("language", ""),
        created_at=doc["created_at"],
    )


# ── Dashboard ───────────────────────────────────────────────────────────────


@router.get("/dashboard", response_model=InstructorDashboardStats)
async def dashboard(user: dict = Depends(_instructor)):
    db = get_university_db(user["university_slug"])
    course_count = await db.courses.count_documents(
        {"instructor_email": user["sub"]}
    )
    return InstructorDashboardStats(course_count=course_count)


# ── Courses ─────────────────────────────────────────────────────────────────


@router.get("/courses", response_model=list[CourseResponse])
async def list_courses(user: dict = Depends(_instructor)):
    db = get_university_db(user["university_slug"])
    docs = (
        await db.courses.find({"instructor_email": user["sub"]})
        .sort("created_at", -1)
        .to_list(length=None)
    )
    return [_doc_to_course(d) for d in docs]


@router.post(
    "/courses",
    response_model=CourseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_course(body: CourseCreate, user: dict = Depends(_instructor)):
    db = get_university_db(user["university_slug"])

    await db.courses.create_index(
        [("code", 1), ("term", 1)], unique=True
    )

    existing = await db.courses.find_one({"code": body.code, "term": body.term})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Course {body.code} already exists for {body.term}",
        )

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
    return _doc_to_course(doc)


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
    return _doc_to_course(course)


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
    return _doc_to_course(doc)


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
    return oid, db, course


@router.get(
    "/courses/{course_id}/assignments",
    response_model=list[AssignmentResponse],
)
async def list_assignments(course_id: str, user: dict = Depends(_instructor)):
    oid, db, _ = await _get_instructor_course(course_id, user)
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
    oid, db, _ = await _get_instructor_course(course_id, user)

    doc = {
        "course_id": oid,
        "title": body.title,
        "description": body.description,
        "due_date": body.due_date,
        "max_score": body.max_score,
        "allow_resubmission": body.allow_resubmission,
        "language": body.language,
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
    _, db, _ = await _get_instructor_course(course_id, user)
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
    _, db, _ = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    result = await db.assignments.delete_one({"_id": a_oid})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )


# ── Token Generation ────────────────────────────────────────────────────────


@router.post(
    "/courses/{course_id}/assignments/{assignment_id}/token",
    response_model=SubmissionTokenResponse,
)
async def generate_submission_token(
    course_id: str,
    assignment_id: str,
    user: dict = Depends(_instructor),
):
    c_oid, db, course = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    assignment = await db.assignments.find_one({"_id": a_oid, "course_id": c_oid})
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    # Look up university name and logo
    main_db = get_main_db()
    uni = await main_db.universities.find_one({"slug": user["university_slug"]})
    university_name = uni["name"] if uni else user["university_slug"]
    logo_url = uni.get("logo_url") if uni else None

    # Token uses a far-future exp (1 year safety net).
    # Actual deadline enforcement uses the live due_date from the DB,
    # so extending a deadline automatically keeps existing tokens valid.
    token_exp = datetime.now(timezone.utc) + timedelta(days=365)

    # Display expiry: show the assignment due_date if set, otherwise the token exp
    if assignment.get("due_date"):
        display_exp = assignment["due_date"]
        if display_exp.tzinfo is None:
            display_exp = display_exp.replace(tzinfo=timezone.utc)
    else:
        display_exp = token_exp

    payload = {
        "type": "submission",
        "university_slug": user["university_slug"],
        "university_name": university_name,
        "instructor_name": course["instructor_name"],
        "course_id": str(c_oid),
        "course_code": course["code"],
        "course_title": course["title"],
        "assignment_id": str(a_oid),
        "assignment_title": assignment["title"],
        "language": assignment.get("language", ""),
        "exp": token_exp,
    }

    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return SubmissionTokenResponse(token=token, expires_at=display_exp)


# ── Submissions List ────────────────────────────────────────────────────────


@router.get(
    "/courses/{course_id}/assignments/{assignment_id}/submissions",
    response_model=list[AnonymousSubmissionResponse],
)
async def list_submissions(
    course_id: str,
    assignment_id: str,
    user: dict = Depends(_instructor),
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    # Only the latest submission per student
    pipeline = [
        {"$match": {"assignment_id": a_oid, "course_id": c_oid}},
        {"$sort": {"submitted_at": -1}},
        {
            "$group": {
                "_id": "$student_number",
                "doc": {"$first": "$$ROOT"},
            }
        },
        {"$replaceRoot": {"newRoot": "$doc"}},
        {"$sort": {"submitted_at": -1}},
    ]

    docs = await db.submissions.aggregate(pipeline).to_list(length=None)

    return [
        AnonymousSubmissionResponse(
            id=str(d["_id"]),
            assignment_id=str(d["assignment_id"]),
            course_id=str(d["course_id"]),
            language=d["language"],
            comment=d.get("comment"),
            files=d.get("files", []),
            submitted_at=d["submitted_at"],
        )
        for d in docs
    ]


# ── Course Students ────────────────────────────────────────────────────────


def _doc_to_course_student(doc: dict) -> CourseStudentResponse:
    return CourseStudentResponse(
        id=str(doc["_id"]),
        full_name=doc["full_name"],
        email=doc["email"],
        student_number=doc["student_number"],
    )


@router.get(
    "/courses/{course_id}/students",
    response_model=list[CourseStudentResponse],
)
async def list_enrolled_students(
    course_id: str, user: dict = Depends(_instructor)
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    docs = await db.student_records.find(
        {"course_ids": c_oid}
    ).to_list(length=None)
    return [_doc_to_course_student(d) for d in docs]


@router.get(
    "/courses/{course_id}/available-students",
    response_model=list[CourseStudentResponse],
)
async def list_available_students(
    course_id: str, user: dict = Depends(_instructor)
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    docs = await db.student_records.find(
        {"course_ids": {"$ne": c_oid}}
    ).to_list(length=None)
    return [_doc_to_course_student(d) for d in docs]


@router.post(
    "/courses/{course_id}/students",
    response_model=list[CourseStudentResponse],
)
async def enroll_students(
    course_id: str,
    body: EnrollStudentsRequest,
    user: dict = Depends(_instructor),
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    student_oids = [_parse_object_id(sid) for sid in body.student_ids]
    await db.student_records.update_many(
        {"_id": {"$in": student_oids}},
        {"$addToSet": {"course_ids": c_oid}},
    )
    docs = await db.student_records.find(
        {"course_ids": c_oid}
    ).to_list(length=None)
    return [_doc_to_course_student(d) for d in docs]


@router.delete(
    "/courses/{course_id}/students/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_student(
    course_id: str,
    student_id: str,
    user: dict = Depends(_instructor),
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    s_oid = _parse_object_id(student_id)
    result = await db.student_records.update_one(
        {"_id": s_oid},
        {"$pull": {"course_ids": c_oid}},
    )
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )


# ── Send Token Email ───────────────────────────────────────────────────────


@router.post(
    "/courses/{course_id}/assignments/{assignment_id}/send-token",
)
async def send_token_email(
    course_id: str,
    assignment_id: str,
    body: SendTokenEmailRequest,
    user: dict = Depends(_instructor),
):
    c_oid, db, course = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    assignment = await db.assignments.find_one({"_id": a_oid, "course_id": c_oid})
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    # Look up university name, logo, and theme color
    main_db = get_main_db()
    uni = await main_db.universities.find_one({"slug": user["university_slug"]})
    university_name = uni["name"] if uni else user["university_slug"]
    logo_url = uni.get("logo_url") if uni else None
    primary_color = uni.get("primary_color") if uni else None

    # Generate token with far-future exp (deadline enforced from live DB)
    token_exp = datetime.now(timezone.utc) + timedelta(days=365)
    payload = {
        "type": "submission",
        "university_slug": user["university_slug"],
        "university_name": university_name,
        "instructor_name": course["instructor_name"],
        "course_id": str(c_oid),
        "course_code": course["code"],
        "course_title": course["title"],
        "assignment_id": str(a_oid),
        "assignment_title": assignment["title"],
        "language": assignment.get("language", ""),
        "exp": token_exp,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    submission_url = f"https://4-p02-project.vercel.app/submit?token={token}"

    # Fetch students
    if body.send_to_all:
        students = await db.student_records.find(
            {"course_ids": c_oid}
        ).to_list(length=None)
    else:
        if not body.student_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide student_ids or set send_to_all=true",
            )
        student_oids = [_parse_object_id(sid) for sid in body.student_ids]
        students = await db.student_records.find(
            {"_id": {"$in": student_oids}}
        ).to_list(length=None)

    if not students:
        return {"sent_count": 0}

    due_date_str = ""
    if assignment.get("due_date"):
        due_date_str = assignment["due_date"].strftime("%B %d, %Y at %I:%M %p UTC")

    allow_resub = assignment.get("allow_resubmission", False)

    from src.services.email import send_assignment_token_email

    import logging
    _email_logger = logging.getLogger("email_thread")

    def _send_email_thread(kwargs):
        try:
            send_assignment_token_email(**kwargs)
        except Exception:
            _email_logger.exception("Background email thread failed for %s", kwargs.get("to_email"))

    for student in students:
        threading.Thread(
            target=_send_email_thread,
            args=({
                "to_email": student["email"],
                "student_name": student["full_name"],
                "course_code": course["code"],
                "course_title": course["title"],
                "assignment_title": assignment["title"],
                "submission_url": submission_url,
                "due_date": due_date_str,
                "logo_url": logo_url,
                "primary_color": primary_color,
                "allow_resubmission": allow_resub,
                "token": token,
            },),
            daemon=True,
        ).start()

    return {"sent_count": len(students)}
