"""Tests for the public submission endpoint."""

import os
from datetime import datetime, timedelta, timezone

from jose import jwt

from src.config.settings import settings
from tests.helpers import TEST_UNI_SLUG


def _make_submission_token(assignment_id: str, course_id: str, expired=False) -> str:
    exp = datetime.now(timezone.utc) + (
        timedelta(days=-1) if expired else timedelta(days=30)
    )
    payload = {
        "type": "submission",
        "university_slug": TEST_UNI_SLUG,
        "university_name": "Test University",
        "instructor_name": "Test Instructor",
        "course_id": course_id,
        "course_code": "CS101",
        "course_title": "Intro to CS",
        "assignment_id": assignment_id,
        "assignment_title": "Assignment 1",
        "language": "java",
        "exp": exp,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


class TestGetAssignment:
    async def test_valid_token(self, client, seed_university, sample_assignment):
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)
        resp = await client.get(f"/api/public/assignment?token={token}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["assignment_title"] == "Assignment 1"
        assert data["university_slug"] == TEST_UNI_SLUG

    async def test_expired_token(self, client, seed_university, sample_assignment):
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid, expired=True)
        resp = await client.get(f"/api/public/assignment?token={token}")
        assert resp.status_code == 401

    async def test_invalid_token(self, client):
        resp = await client.get("/api/public/assignment?token=garbage")
        assert resp.status_code == 401

    async def test_wrong_token_type(self, client, seed_university, sample_assignment):
        """Token with type != 'submission' should be rejected."""
        aid = str(sample_assignment["_id"])
        payload = {
            "type": "access",
            "university_slug": TEST_UNI_SLUG,
            "assignment_id": aid,
            "exp": datetime.now(timezone.utc) + timedelta(days=1),
        }
        token = jwt.encode(
            payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
        )
        resp = await client.get(f"/api/public/assignment?token={token}")
        assert resp.status_code == 401


class TestSubmitAssignment:
    async def test_submit_valid(
        self, client, seed_university, sample_assignment, sample_student
    ):
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)

        # Ensure upload dir exists
        upload_dir = os.path.join(
            settings.UPLOAD_DIR, TEST_UNI_SLUG, cid, aid, "STU001"
        )
        os.makedirs(os.path.dirname(upload_dir), exist_ok=True)

        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
            },
            files=[("files", ("Main.java", b"public class Main {}", "text/plain"))],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["student_number"] == "STU001"
        assert len(data["files"]) == 1

    async def test_wrong_file_type(
        self, client, seed_university, sample_assignment, sample_student
    ):
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)
        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
            },
            files=[("files", ("script.py", b"print('hi')", "text/plain"))],
        )
        assert resp.status_code == 400

    async def test_not_enrolled(self, client, seed_university, sample_assignment):
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)
        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Nobody",
                "student_email": "nobody@test.edu",
                "student_number": "NOBODY",
            },
            files=[("files", ("Main.java", b"class X{}", "text/plain"))],
        )
        assert resp.status_code == 403

    async def test_resubmission_blocked(
        self, client, seed_university, sample_assignment, sample_student, mongo_client
    ):
        db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
        await db.submissions.insert_one(
            {
                "assignment_id": sample_assignment["_id"],
                "course_id": sample_assignment["course_id"],
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
                "language": "java",
                "files": [{"name": "Main.java", "size": 10}],
                "submitted_at": datetime.now(timezone.utc),
            }
        )
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)
        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
            },
            files=[("files", ("Main.java", b"class X{}", "text/plain"))],
        )
        assert resp.status_code == 409
