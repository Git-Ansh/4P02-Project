import asyncio
import os
import shutil
import threading
import zipfile
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
import tempfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from jose import jwt

from src.api.deps import require_role
from src.config.database import get_university_db, get_main_db
from src.config.settings import settings
from src.models.schemas import (
    AnalysisReportResponse,
    AnalysisRunResponse,
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
    ReferenceSubmissionResponse,
    SendTokenEmailRequest,
    SubmissionTokenResponse,
)

router = APIRouter(prefix="/api/instructor", tags=["Instructor"])


# ── Student Anonymization ──────────────────────────────────────────────────
# Instructors must NEVER see real student identifiers.  We map every unique
# student id that appears in an analysis report to "Student A", "Student B", …

def _anon_label(index: int) -> str:
    """0 → 'Student A', 25 → 'Student Z', 26 → 'Student AA', …"""
    letters = ""
    n = index
    while True:
        letters = chr(ord("A") + n % 26) + letters
        n = n // 26 - 1
        if n < 0:
            break
    return f"Student {letters}"


def _build_anon_map(pairs: list[dict]) -> dict[str, str]:
    """Build a stable mapping of real student id → anonymous label."""
    seen: dict[str, str] = {}
    for pair in pairs:
        for key in ("student_1", "student_2"):
            sid = pair.get(key, "")
            if sid and sid not in seen:
                seen[sid] = _anon_label(len(seen))
    return seen


def _anonymize_pairs(pairs: list[dict], anon_map: dict[str, str]) -> list[dict]:
    """Return a deep-ish copy of pairs with all student IDs anonymized."""
    out = []
    for idx, pair in enumerate(pairs):
        p = dict(pair)  # shallow copy
        s1, s2 = p.get("student_1", ""), p.get("student_2", "")
        p["student_1"] = anon_map.get(s1, s1)
        p["student_2"] = anon_map.get(s2, s2)
        # Use a simple index-based pair_id (URL-safe, no student info)
        p["pair_id"] = f"pair_{idx}"
        # Anonymize nested sources keys if present
        if "sources" in p and isinstance(p["sources"], dict):
            new_sources: dict = {}
            for k, v in p["sources"].items():
                new_key = anon_map.get(k, k)
                new_sources[new_key] = v
            p["sources"] = new_sources
        # Anonymize nested files keys if present
        if "files" in p and isinstance(p["files"], dict):
            new_files: dict = {}
            for k, v in p["files"].items():
                new_key = anon_map.get(k, k)
                new_files[new_key] = v
            p["files"] = new_files
        out.append(p)
    return out

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
    slug = user["university_slug"]

    courses = await db.courses.find(
        {"instructor_email": user["sub"]}
    ).to_list(length=None)
    course_count = len(courses)
    course_ids = [c["_id"] for c in courses]
    course_map = {str(c["_id"]): c for c in courses}

    total_assignments = 0
    total_submissions = 0
    assignment_map = {}
    if course_ids:
        total_assignments = await db.assignments.count_documents(
            {"course_id": {"$in": course_ids}}
        )
        total_submissions = await db.submissions.count_documents(
            {"course_id": {"$in": course_ids}}
        )
        assignments = await db.assignments.find(
            {"course_id": {"$in": course_ids}}
        ).to_list(length=None)
        assignment_map = {str(a["_id"]): a for a in assignments}

    # Recent analyses
    recent_analyses = []
    if course_ids:
        runs = await db.analysis_runs.find(
            {"course_id": {"$in": course_ids}}
        ).sort("started_at", -1).to_list(length=5)
        for run in runs:
            cid = str(run["course_id"])
            aid = str(run["assignment_id"])
            course = course_map.get(cid, {})
            assignment = assignment_map.get(aid, {})
            report = run.get("report", {})
            pairs = report.get("pairs", [])
            top_sev = max((p.get("severity_score", 0) for p in pairs), default=0)
            recent_analyses.append({
                "id": str(run["_id"]),
                "assignment_id": aid,
                "course_id": cid,
                "assignment_title": assignment.get("title", "Unknown"),
                "course_code": course.get("code", "Unknown"),
                "status": run.get("status", "unknown"),
                "pairs_flagged": len(pairs),
                "top_severity": round(top_sev, 2),
                "completed_at": run.get("completed_at"),
                "started_at": run.get("started_at"),
            })

    # Flagged pairs across all analyses
    flagged_pairs = []
    if course_ids:
        completed_runs = await db.analysis_runs.find(
            {"course_id": {"$in": course_ids}, "status": "completed"}
        ).sort("completed_at", -1).to_list(length=10)
        for run in completed_runs:
            cid = str(run["course_id"])
            aid = str(run["assignment_id"])
            course = course_map.get(cid, {})
            assignment = assignment_map.get(aid, {})
            report = run.get("report", {})
            run_pairs = report.get("pairs", [])
            anon = _build_anon_map(run_pairs)
            for idx, pair in enumerate(run_pairs):
                if pair.get("severity_score", 0) >= 0.3:
                    s1 = anon.get(pair["student_1"], pair["student_1"])
                    s2 = anon.get(pair["student_2"], pair["student_2"])
                    flagged_pairs.append({
                        "pair_id": f"pair_{idx}",
                        "assignment_id": aid,
                        "course_id": cid,
                        "assignment_title": assignment.get("title", "Unknown"),
                        "course_code": course.get("code", "Unknown"),
                        "student_1": s1,
                        "student_2": s2,
                        "similarity": pair["similarity"],
                        "severity_score": pair["severity_score"],
                    })
    flagged_pairs.sort(key=lambda x: x["severity_score"], reverse=True)
    flagged_pairs = flagged_pairs[:20]

    return InstructorDashboardStats(
        course_count=course_count,
        total_assignments=total_assignments,
        total_submissions=total_submissions,
        recent_analyses=recent_analyses,
        flagged_pairs=flagged_pairs,
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

    # Look up university name
    main_db = get_main_db()
    uni = await main_db.universities.find_one({"slug": user["university_slug"]})
    university_name = uni["name"] if uni else user["university_slug"]

    # Expiry: assignment due_date if set, otherwise 30 days
    if assignment.get("due_date"):
        expires_at = assignment["due_date"]
        # If due_date is naive, make it UTC-aware
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)

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
        "exp": expires_at,
    }

    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return SubmissionTokenResponse(token=token, expires_at=expires_at)


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


@router.get(
    "/courses/{course_id}/assignments/{assignment_id}/submissions/download",
)
async def download_submissions(
    course_id: str,
    assignment_id: str,
    user: dict = Depends(_instructor),
):
    """Download all latest submissions as a single ZIP file (anonymised)."""
    c_oid, db, course = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    assignment = await db.assignments.find_one({"_id": a_oid, "course_id": c_oid})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    pipeline = [
        {"$match": {"assignment_id": a_oid, "course_id": c_oid}},
        {"$sort": {"submitted_at": -1}},
        {"$group": {"_id": "$student_number", "doc": {"$first": "$$ROOT"}}},
        {"$replaceRoot": {"newRoot": "$doc"}},
        {"$sort": {"submitted_at": -1}},
    ]
    docs = await db.submissions.aggregate(pipeline).to_list(length=None)

    if not docs:
        raise HTTPException(status_code=404, detail="No submissions found")

    slug = user["university_slug"]
    upload_base = os.path.join(
        settings.UPLOAD_DIR, slug, str(c_oid), str(a_oid)
    )

    tmp = tempfile.NamedTemporaryFile(
        delete=False, suffix=".zip", prefix="submissions_"
    )
    tmp.close()

    with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx, doc in enumerate(docs, start=1):
            student_dir = os.path.join(upload_base, doc["student_number"])
            folder_name = f"Submission_{idx:02d}"
            if not os.path.isdir(student_dir):
                continue
            for root, _, files in os.walk(student_dir):
                for fname in files:
                    full = os.path.join(root, fname)
                    arcname = os.path.join(
                        folder_name, os.path.relpath(full, student_dir)
                    )
                    zf.write(full, arcname)

    safe_title = assignment.get("title", "assignment").replace(" ", "_")
    filename = f"{course.get('code', 'course')}_{safe_title}_submissions.zip"

    return FileResponse(
        tmp.name,
        media_type="application/zip",
        filename=filename,
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


# ── Analysis ───────────────────────────────────────────────────────────────


@router.post(
    "/courses/{course_id}/assignments/{assignment_id}/analysis/run",
    response_model=AnalysisRunResponse,
    status_code=status.HTTP_201_CREATED,
)
async def trigger_analysis(
    course_id: str,
    assignment_id: str,
    user: dict = Depends(_instructor),
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    assignment = await db.assignments.find_one({"_id": a_oid, "course_id": c_oid})
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    # Check if analysis is already running
    existing = await db.analysis_runs.find_one({
        "assignment_id": a_oid, "course_id": c_oid, "status": "running",
    })
    if existing:
        return AnalysisRunResponse(
            id=str(existing["_id"]),
            status="running",
            started_at=existing["started_at"],
        )

    now = datetime.now(timezone.utc)
    doc = {
        "assignment_id": a_oid,
        "course_id": c_oid,
        "status": "running",
        "error": None,
        "started_at": now,
        "completed_at": None,
        "report": {},
    }
    result = await db.analysis_runs.insert_one(doc)
    run_id = result.inserted_id

    slug = user["university_slug"]
    from src.services.analysis import run_analysis_background
    asyncio.create_task(run_analysis_background(db, run_id, slug, c_oid, a_oid))

    return AnalysisRunResponse(id=str(run_id), status="running", started_at=now)


@router.get(
    "/courses/{course_id}/assignments/{assignment_id}/analysis",
    response_model=AnalysisReportResponse,
)
async def get_analysis(
    course_id: str,
    assignment_id: str,
    user: dict = Depends(_instructor),
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    run = await db.analysis_runs.find_one(
        {"assignment_id": a_oid, "course_id": c_oid},
        sort=[("started_at", -1)],
    )
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No analysis found")

    report = run.get("report", {})
    raw_pairs = report.get("pairs") or []
    anon = _build_anon_map(raw_pairs)
    anon_pairs = _anonymize_pairs(raw_pairs, anon) if raw_pairs else raw_pairs
    return AnalysisReportResponse(
        id=str(run["_id"]),
        status=run["status"],
        started_at=run["started_at"],
        completed_at=run.get("completed_at"),
        error=run.get("error"),
        metadata=report.get("metadata"),
        pairs=anon_pairs or None,
    )


@router.get(
    "/courses/{course_id}/assignments/{assignment_id}/analysis/{pair_id}",
)
async def get_analysis_pair(
    course_id: str,
    assignment_id: str,
    pair_id: str,
    user: dict = Depends(_instructor),
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    run = await db.analysis_runs.find_one(
        {"assignment_id": a_oid, "course_id": c_oid, "status": "completed"},
        sort=[("started_at", -1)],
    )
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No completed analysis found")

    pairs = run.get("report", {}).get("pairs", [])
    anon = _build_anon_map(pairs)
    anon_pairs = _anonymize_pairs(pairs, anon)
    for pair in anon_pairs:
        if pair.get("pair_id") == pair_id:
            return pair

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pair not found")


@router.get("/analysis/recent")
async def recent_analyses(user: dict = Depends(_instructor)):
    db = get_university_db(user["university_slug"])
    courses = await db.courses.find(
        {"instructor_email": user["sub"]}
    ).to_list(length=None)
    course_ids = [c["_id"] for c in courses]
    course_map = {str(c["_id"]): c for c in courses}

    if not course_ids:
        return []

    assignment_docs = await db.assignments.find(
        {"course_id": {"$in": course_ids}}
    ).to_list(length=None)
    assignment_map = {str(a["_id"]): a for a in assignment_docs}

    runs = await db.analysis_runs.find(
        {"course_id": {"$in": course_ids}}
    ).sort("started_at", -1).to_list(length=20)

    results = []
    for run in runs:
        cid = str(run["course_id"])
        aid = str(run["assignment_id"])
        course = course_map.get(cid, {})
        assignment = assignment_map.get(aid, {})
        report = run.get("report", {})
        pairs = report.get("pairs", [])
        top_sev = max((p.get("severity_score", 0) for p in pairs), default=0)
        results.append({
            "id": str(run["_id"]),
            "assignment_id": aid,
            "course_id": cid,
            "assignment_title": assignment.get("title", "Unknown"),
            "course_code": course.get("code", "Unknown"),
            "status": run.get("status", "unknown"),
            "pairs_flagged": len(pairs),
            "top_severity": round(top_sev, 2),
            "completed_at": run.get("completed_at"),
            "started_at": run.get("started_at"),
        })
    return results


@router.delete(
    "/analysis/{run_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_analysis_run(run_id: str, user: dict = Depends(_instructor)):
    """Delete a specific analysis run."""
    db = get_university_db(user["university_slug"])
    try:
        run_oid = ObjectId(run_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid run ID")

    run = await db.analysis_runs.find_one({"_id": run_oid})
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")

    # Verify the instructor owns the course
    course = await db.courses.find_one({
        "_id": run["course_id"],
        "instructor_email": user["sub"],
    })
    if not course:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.analysis_runs.delete_one({"_id": run_oid})


# ── Reference Submissions ──────────────────────────────────────────────────


@router.post(
    "/courses/{course_id}/assignments/{assignment_id}/references",
    response_model=ReferenceSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_reference(
    course_id: str,
    assignment_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(_instructor),
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    assignment = await db.assignments.find_one({"_id": a_oid, "course_id": c_oid})
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be a ZIP archive")

    slug = user["university_slug"]
    ref_dir = os.path.join(
        settings.UPLOAD_DIR, slug, str(c_oid), str(a_oid), "_references"
    )
    os.makedirs(ref_dir, exist_ok=True)

    ref_id = ObjectId()
    zip_path = os.path.join(ref_dir, f"{ref_id}.zip")

    content = await file.read()
    with open(zip_path, "wb") as f:
        f.write(content)

    # Count students inside the zip
    student_count = 0
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            top_level = set()
            for name in zf.namelist():
                parts = name.split("/")
                if parts[0]:
                    top_level.add(parts[0])
            student_count = len(top_level)
    except Exception:
        pass

    now = datetime.now(timezone.utc)
    doc = {
        "_id": ref_id,
        "assignment_id": a_oid,
        "course_id": c_oid,
        "filename": file.filename,
        "zip_path": zip_path,
        "student_count": student_count,
        "uploaded_at": now,
    }
    await db.reference_submissions.insert_one(doc)

    return ReferenceSubmissionResponse(
        id=str(ref_id),
        filename=file.filename,
        student_count=student_count,
        uploaded_at=now,
    )


@router.get(
    "/courses/{course_id}/assignments/{assignment_id}/references",
    response_model=list[ReferenceSubmissionResponse],
)
async def list_references(
    course_id: str,
    assignment_id: str,
    user: dict = Depends(_instructor),
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    docs = await db.reference_submissions.find(
        {"assignment_id": a_oid, "course_id": c_oid}
    ).sort("uploaded_at", -1).to_list(length=None)

    return [
        ReferenceSubmissionResponse(
            id=str(d["_id"]),
            filename=d["filename"],
            student_count=d.get("student_count", 0),
            uploaded_at=d["uploaded_at"],
        )
        for d in docs
    ]


@router.delete(
    "/courses/{course_id}/assignments/{assignment_id}/references/{ref_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_reference(
    course_id: str,
    assignment_id: str,
    ref_id: str,
    user: dict = Depends(_instructor),
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    r_oid = _parse_object_id(ref_id)

    doc = await db.reference_submissions.find_one({"_id": r_oid, "course_id": c_oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reference not found")

    zip_path = doc.get("zip_path", "")
    if os.path.isfile(zip_path):
        os.remove(zip_path)

    await db.reference_submissions.delete_one({"_id": r_oid})


# ── Template / Boilerplate ─────────────────────────────────────────────────


@router.post(
    "/courses/{course_id}/assignments/{assignment_id}/template",
    status_code=status.HTTP_201_CREATED,
)
async def upload_template(
    course_id: str,
    assignment_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(_instructor),
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    assignment = await db.assignments.find_one({"_id": a_oid, "course_id": c_oid})
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    slug = user["university_slug"]
    template_dir = os.path.join(
        settings.UPLOAD_DIR, slug, str(c_oid), str(a_oid), "_template"
    )
    os.makedirs(template_dir, exist_ok=True)

    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename required")

    file_path = os.path.join(template_dir, file.filename)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    return {"filename": file.filename, "message": "Template file uploaded"}


@router.get(
    "/courses/{course_id}/assignments/{assignment_id}/template",
)
async def list_templates(
    course_id: str,
    assignment_id: str,
    user: dict = Depends(_instructor),
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    slug = user["university_slug"]
    template_dir = os.path.join(
        settings.UPLOAD_DIR, slug, str(c_oid), str(a_oid), "_template"
    )

    if not os.path.isdir(template_dir):
        return []

    files = []
    for fname in os.listdir(template_dir):
        fpath = os.path.join(template_dir, fname)
        if os.path.isfile(fpath):
            files.append({"filename": fname, "size": os.path.getsize(fpath)})
    return files


@router.delete(
    "/courses/{course_id}/assignments/{assignment_id}/template/{filename}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_template(
    course_id: str,
    assignment_id: str,
    filename: str,
    user: dict = Depends(_instructor),
):
    c_oid, db, _ = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    slug = user["university_slug"]
    file_path = os.path.join(
        settings.UPLOAD_DIR, slug, str(c_oid), str(a_oid), "_template", filename
    )

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template file not found")

    os.remove(file_path)


# ── Identity Reveal Requests ──────────────────────────────────────────────


@router.post(
    "/courses/{course_id}/assignments/{assignment_id}/analysis/reveal-request",
    status_code=status.HTTP_201_CREATED,
)
async def request_identity_reveal(
    course_id: str,
    assignment_id: str,
    body: dict,
    user: dict = Depends(_instructor),
):
    """
    Instructor submits a request to the university admin to reveal the real
    identities behind an anonymous pair.  The admin must approve before
    real student numbers are disclosed.
    """
    c_oid, db, course = await _get_instructor_course(course_id, user)
    a_oid = _parse_object_id(assignment_id)

    pair_id = body.get("pair_id", "")
    justification = body.get("justification", "")
    if not pair_id or not justification:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="pair_id and justification are required",
        )

    # Look up the real student IDs from the anonymous pair_id
    run = await db.analysis_runs.find_one(
        {"assignment_id": a_oid, "course_id": c_oid, "status": "completed"},
        sort=[("started_at", -1)],
    )
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No completed analysis found")

    raw_pairs = run.get("report", {}).get("pairs", [])

    # pair_id is "pair_{index}" — extract the index to find the original pair
    if not pair_id.startswith("pair_"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid pair_id format")
    try:
        pair_idx = int(pair_id.split("_", 1)[1])
    except (ValueError, IndexError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid pair_id format")
    if pair_idx < 0 or pair_idx >= len(raw_pairs):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pair not found in analysis")

    original_pair = raw_pairs[pair_idx]
    real_1 = original_pair["student_1"]
    real_2 = original_pair["student_2"]

    now = datetime.now(timezone.utc)
    doc = {
        "course_id": c_oid,
        "assignment_id": a_oid,
        "pair_id": pair_id,
        "real_student_1": real_1,
        "real_student_2": real_2,
        "instructor_email": user["sub"],
        "instructor_name": user.get("name", user["sub"]),
        "course_code": course.get("code", ""),
        "justification": justification,
        "status": "pending",  # pending | approved | denied
        "requested_at": now,
        "resolved_at": None,
        "resolved_by": None,
    }
    result = await db.reveal_requests.insert_one(doc)

    return {
        "id": str(result.inserted_id),
        "status": "pending",
        "message": "Your request has been submitted to the university administrator for review.",
    }
