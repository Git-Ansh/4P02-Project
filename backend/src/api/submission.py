import os
import shutil
import threading
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from jose import JWTError, jwt

from src.config.database import get_university_db, get_main_db
from src.config.settings import settings
from src.models.schemas import PublicAssignmentResponse, SubmissionResponse
from src.services.email import send_submission_receipt

router = APIRouter(prefix="/api/public", tags=["Public Submission"])


def _decode_submission_token(token: str) -> dict:
    """Decode and validate a submission JWT token."""
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired submission token",
        )
    if payload.get("type") != "submission":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    return payload


@router.get("/assignment", response_model=PublicAssignmentResponse)
async def get_assignment_from_token(token: str):
    """Decode a submission token and return live assignment details."""
    payload = _decode_submission_token(token)

    slug = payload["university_slug"]
    db = get_university_db(slug)

    try:
        a_oid = ObjectId(payload["assignment_id"])
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment ID in token",
        )

    assignment = await db.assignments.find_one({"_id": a_oid})
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment no longer exists",
        )

    # Fetch university name from main DB
    main_db = get_main_db()
    uni = await main_db.universities.find_one({"slug": slug})
    university_name = uni["name"] if uni else payload.get("university_name", slug)

    return PublicAssignmentResponse(
        university_name=university_name,
        university_slug=slug,
        instructor_name=payload.get("instructor_name", ""),
        course_code=payload.get("course_code", ""),
        course_title=payload.get("course_title", ""),
        assignment_id=str(assignment["_id"]),
        assignment_title=assignment["title"],
        assignment_description=assignment.get("description"),
        due_date=assignment.get("due_date"),
        max_score=assignment.get("max_score", 100),
        allow_resubmission=assignment.get("allow_resubmission", False),
        language=assignment.get("language", ""),
    )


ALLOWED_EXTENSIONS = {
    "c": [".c", ".h"],
    "cpp": [".cpp", ".cc", ".cxx", ".h", ".hpp", ".hh", ".hxx"],
    "java": [".java"],
    "python": [".py"],
}


@router.post("/submit", response_model=SubmissionResponse)
async def submit_assignment(
    token: str = Form(...),
    student_name: str = Form(...),
    student_email: str = Form(...),
    student_number: str = Form(...),
    comment: str = Form(None),
    files: list[UploadFile] = File(...),
):
    """Accept a student submission (multipart/form-data, no auth required)."""
    # 1. Decode token
    payload = _decode_submission_token(token)
    slug = payload["university_slug"]

    try:
        course_oid = ObjectId(payload["course_id"])
        assignment_oid = ObjectId(payload["assignment_id"])
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid IDs in token",
        )

    db = get_university_db(slug)

    # 2. Verify student is enrolled
    student_record = await db.student_records.find_one({
        "email": student_email,
        "student_number": student_number,
    })
    if not student_record:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student not found. Check your email and student number.",
        )
    if course_oid not in student_record.get("course_ids", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this course.",
        )

    # 3. Check resubmission policy
    assignment = await db.assignments.find_one({"_id": assignment_oid})
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment no longer exists",
        )

    # Enforce live due_date from DB (dynamic — survives deadline extensions)
    due_date = assignment.get("due_date")
    if due_date:
        if due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > due_date:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The deadline for this assignment has passed.",
            )

    # Read language from assignment (set by instructor)
    language = assignment.get("language", "")

    # Validate file extensions against the assignment language
    allowed_exts = ALLOWED_EXTENSIONS.get(language, [])
    if allowed_exts:
        for f in files:
            lower_name = f.filename.lower() if f.filename else ""
            if not any(lower_name.endswith(ext) for ext in allowed_exts):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f'File "{f.filename}" is not allowed for {language}. Allowed extensions: {", ".join(allowed_exts)}',
                )

    allow_resubmission = assignment.get("allow_resubmission", False)
    existing_submission = await db.submissions.find_one({
        "assignment_id": assignment_oid,
        "student_number": student_number,
    })

    if existing_submission and not allow_resubmission:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already submitted this assignment. Resubmissions are not allowed.",
        )

    # 4. If resubmission allowed and existing submission, delete old files + record
    upload_dir = os.path.join(
        settings.UPLOAD_DIR, slug, str(course_oid), str(assignment_oid), student_number
    )

    if existing_submission and allow_resubmission:
        # Remove old files from disk
        if os.path.exists(upload_dir):
            shutil.rmtree(upload_dir)
        # Remove old DB record
        await db.submissions.delete_one({"_id": existing_submission["_id"]})

    # 5. Save files to disk
    os.makedirs(upload_dir, exist_ok=True)

    file_infos = []
    for f in files:
        content = await f.read()
        file_path = os.path.join(upload_dir, f.filename)
        with open(file_path, "wb") as fp:
            fp.write(content)
        file_infos.append({"name": f.filename, "size": len(content)})

    # 6. Insert submission document
    now = datetime.now(timezone.utc)
    doc = {
        "assignment_id": assignment_oid,
        "course_id": course_oid,
        "student_name": student_name,
        "student_email": student_email,
        "student_number": student_number,
        "language": language,
        "comment": comment,
        "files": file_infos,
        "submitted_at": now,
    }
    result = await db.submissions.insert_one(doc)

    submission_id = str(result.inserted_id)

    # 7. Send email receipt in background thread (non-blocking)
    course_code = payload.get("course_code", "")
    course_title = payload.get("course_title", "")
    assignment_title = assignment["title"]
    submitted_at_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")

    # Fetch university logo and theme for email branding
    main_db = get_main_db()
    uni = await main_db.universities.find_one({"slug": slug})
    logo_url = uni.get("logo_url") if uni else None
    primary_color = uni.get("primary_color") if uni else None

    threading.Thread(
        target=send_submission_receipt,
        kwargs={
            "to_email": student_email,
            "student_name": student_name,
            "course_code": course_code,
            "course_title": course_title,
            "assignment_title": assignment_title,
            "submission_id": submission_id,
            "submitted_at": submitted_at_str,
            "file_count": len(file_infos),
            "language": language,
            "logo_url": logo_url,
            "primary_color": primary_color,
        },
        daemon=True,
    ).start()

    return SubmissionResponse(
        id=submission_id,
        assignment_id=str(assignment_oid),
        course_id=str(course_oid),
        student_name=student_name,
        student_email=student_email,
        student_number=student_number,
        language=language,
        comment=comment,
        files=file_infos,
        submitted_at=now,
    )
