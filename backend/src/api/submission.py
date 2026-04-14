"""
Student submission API router — /api/submit/*

These are the only routes accessible to students (no account required).
A student authenticates by providing a valid assignment token (a URL-safe
JWT issued by an instructor for a specific assignment).

Key endpoints:
    POST /api/submit/verify-token       — validate an assignment token and
                                          return course / assignment metadata
    POST /api/submit/upload             — upload source files or a ZIP archive;
                                          encrypts and stores files on disk and
                                          records the submission in MongoDB
    GET  /api/submit/status/{token}     — check whether a submission already
                                          exists for this student + assignment

File storage
------------
Uploaded files are AES-128 encrypted at rest using Fernet (see
``src/utils/encryption.py``) and stored under:
    UPLOAD_DIR/{university_slug}/{course_id}/{assignment_id}/{submission_id}/
"""

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
from src.utils.zip_utils import resolve_nested_zips
from src.utils.encryption import encrypt_bytes, encrypt_string, make_submission_id

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
    "c": [".zip"],
    "cpp": [".zip"],
    "java": [".zip"],
    "python": [".zip"],
}

# Source-only extensions (no .zip) — used to validate extracted ZIP contents
_SOURCE_EXTENSIONS = {
    "c": {".c", ".h"},
    "cpp": {".cpp", ".cc", ".cxx", ".h", ".hpp", ".hh", ".hxx"},
    "java": {".java"},
    "python": {".py"},
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

    # 2. Check resubmission policy
    assignment = await db.assignments.find_one({"_id": assignment_oid})
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment no longer exists",
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

    # 4. Generate encrypted submission ID (used as folder name on disk)
    submission_id = make_submission_id(student_name, student_number, student_email)

    # 4b. If resubmission allowed and existing submission, delete old files + record
    upload_dir = os.path.join(
        settings.UPLOAD_DIR, slug, str(course_oid), str(assignment_oid), submission_id
    )
    # Also check legacy plaintext folder
    legacy_dir = os.path.join(
        settings.UPLOAD_DIR, slug, str(course_oid), str(assignment_oid), student_number
    )

    if existing_submission and allow_resubmission:
        for d in (upload_dir, legacy_dir):
            if os.path.exists(d):
                shutil.rmtree(d)
        await db.submissions.delete_one({"_id": existing_submission["_id"]})

    # 5. Save files to disk (plaintext first for ZIP extraction + validation)
    os.makedirs(upload_dir, exist_ok=True)

    for f in files:
        content = await f.read()
        file_path = os.path.join(upload_dir, f.filename)
        with open(file_path, "wb") as fp:
            fp.write(content)

    # 5b. Extract any uploaded ZIP files in-place (nested ZIPs resolved recursively)
    resolve_nested_zips(upload_dir)

    # 5c. Validate that extracted contents match the assignment language
    valid_src_exts = _SOURCE_EXTENSIONS.get(language, set())
    if valid_src_exts:
        for root, _, fnames in os.walk(upload_dir):
            for fname in fnames:
                ext = os.path.splitext(fname)[1].lower()
                if ext and ext not in valid_src_exts:
                    shutil.rmtree(upload_dir, ignore_errors=True)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f'File "{fname}" (from ZIP) is not allowed for {language}. Allowed: {", ".join(sorted(valid_src_exts))}',
                    )

    # 5d. Build file_infos, then encrypt all files on disk
    file_infos = []
    for root, _, fnames in os.walk(upload_dir):
        for fname in fnames:
            full = os.path.join(root, fname)
            rel = os.path.relpath(full, upload_dir)
            file_infos.append({"name": rel, "size": os.path.getsize(full)})
            # Encrypt file in-place
            with open(full, "rb") as fh:
                raw = fh.read()
            with open(full, "wb") as fh:
                fh.write(encrypt_bytes(raw))

    if not file_infos:
        shutil.rmtree(upload_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid source files found in submission.",
        )

    # 6. Insert submission document (student identity encrypted)
    now = datetime.now(timezone.utc)
    doc = {
        "assignment_id": assignment_oid,
        "course_id": course_oid,
        "submission_id": submission_id,
        "student_name_enc": encrypt_string(student_name),
        "student_email_enc": encrypt_string(student_email),
        "student_number": student_number,  # kept for resubmission lookup
        "language": language,
        "comment": comment,
        "files": file_infos,
        "submitted_at": now,
    }
    result = await db.submissions.insert_one(doc)

    # 7. Send email receipt in background thread (non-blocking)
    course_code = payload.get("course_code", "")
    course_title = payload.get("course_title", "")
    assignment_title = assignment["title"]
    submitted_at_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")

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
